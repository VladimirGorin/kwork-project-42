require("dotenv").config({ path: "./assets/.env" });
const winston = require("winston");
const { combine, timestamp, printf } = winston.format;

const TESTMODE = false;

const TelegramBotApi = require("node-telegram-bot-api");
const bot = new TelegramBotApi(
  TESTMODE ? process.env.TOKENTEST : process.env.TOKEN,
  { polling: true }
);

const cron = require("node-cron");
const fs = require("fs");

const groupLogger = winston.createLogger({
  level: "info",
  format: combine(
    timestamp(),
    printf((info) => `${info.timestamp} - ${info.message}`)
  ),
  transports: [
    new winston.transports.File({
      filename: "group.log",
      dirname: "./assets/logs/",
    }),
  ],
});

const errorLogger = winston.createLogger({
  level: "error",
  format: combine(
    timestamp(),
    printf((error) => `${error.timestamp} - ${error.message}`)
  ),
  transports: [
    new winston.transports.File({
      filename: "errors.log",
      dirname: "./assets/logs/",
    }),
  ],
});

try {
  const {
    saveIgnoredUsers,
    saveNewGroupFirstText,
    saveNewGroupLastText,
    saveReceipt,
    saveGroups,
    stopBot,
    saveNewButtons,
    restartBot,
  } = require("./assets/modules/utils");
  const commands = JSON.parse(fs.readFileSync("./assets/data/commands.json"));

  bot.setMyCommands(commands);

  function selectGroup(chatId, query) {
    let buttonQueryOption = null;
    const getUserGroups = JSON.parse(
      fs.readFileSync("./assets/data/users.json")
    );
    let user = getUserGroups.filter((x) => x.id === chatId)[0];

    switch (query) {
      case "Добавить людей в игнор":
        buttonQueryOption = "addIgnoredUsers";
        break;
      case "Добавить текст для первого сообщения в группе":
        buttonQueryOption = "addFirstText";
        break;
      case "Добавить текст для второго сообщения в группе":
        buttonQueryOption = "addLastText";
        break;
      case "Изменения кнопок":
        buttonQueryOption = "changeButtons";
        break;
    }

    const availableGroups = user?.groups
      ?.map((g) => {
        if (g.groupName.length >= 30) {
          bot.sendMessage(
            chatId,
            `Группа "${g.groupName}" содержит более 30 символов. Она была удалена из списка ваших групп`
          );
          user.groups = user.groups.filter(
            (group) => group.groupName !== g.groupName
          );
          fs.writeFileSync(
            "./assets/data/users.json",
            JSON.stringify(getUserGroups, null, 2)
          );
          return null;
        }
        return [
          {
            text: g.groupName,
            callback_data: `SG:${g.groupName},${buttonQueryOption}`,
          },
        ];
      })
      .filter(Boolean);
    if (!availableGroups.length) {
      bot.sendMessage(chatId, "У вас ещё нет добавленных групп");
      return;
    }

    if (buttonQueryOption) {
      try {
        bot.sendMessage(chatId, "Выберете группу", {
          reply_markup: JSON.stringify({
            inline_keyboard: [
              [
                {
                  text: "Изминить для всех групп",
                  callback_data: `changeForAll:${buttonQueryOption}`,
                },
              ],
              ...availableGroups,
            ],
          }),
        });
      } catch (error) {
        bot.sendMessage(
          chatId,
          "Ошибка: одна из групп содержит неверный ввод!"
        );
      }
    } else {
      bot.sendMessage(chatId, "Ошибка при отправке групп.");
    }
  }

  const handleAddGroups = (msg) => {
    if (msg.chat.type === "private") {
      saveGroups(msg, bot);
      bot.removeListener("message", handleAddGroups);
    }
  };

  const handleSendReceipt = (msg) => {
    if (msg.chat.type === "private") {
      saveReceipt(msg, bot, TESTMODE);
      bot.removeListener("message", handleSendReceipt);
    }
  };

  const handleAddIgnoredUsers = (msg) => {
    if (msg.chat.type === "private") {
      saveIgnoredUsers(msg, bot);
      bot.removeListener("message", handleAddIgnoredUsers);
    }
  };

  const handleAddLastText = (msg) => {
    if (msg.chat.type === "private") {
      saveNewGroupLastText(msg, bot);
      bot.removeListener("message", handleAddLastText);
    }
  };

  const handleAddFirstText = (msg) => {
    if (msg.chat.type === "private") {
      saveNewGroupFirstText(msg, bot);
      bot.removeListener("message", handleAddFirstText);
    }
  };

  const handleChangeButtons = (msg) => {
    if (msg.chat.type === "private") {
      saveNewButtons(msg, bot);
      bot.removeListener("message", handleChangeButtons);
    }
  };

  function changeAll(msg) {
    if (msg.chat.type === "private") {
      const chatId = msg.chat.id;
      const users = JSON.parse(fs.readFileSync("./assets/data/users.json"));
      const user = users.filter((x) => x.id === chatId)[0];
      const selectedAllGroups = user?.selectedAllGroups;
      const selectedOptionForAllGroups = user?.selectedOptionForAllGroups;
      const text = msg.text;

      if (!selectedAllGroups.length) {
        bot.sendMessage(chatId, "У вас нету выбранных групп.");
      } else if (!selectedOptionForAllGroups) {
        bot.sendMessage(chatId, "У вас нету выбранного варианта.");
      }

      selectedAllGroups.forEach((groupName) => {
        user.selectedGroup = groupName;

        fs.writeFileSync(
          "./assets/data/users.json",
          JSON.stringify(users, null, "\t")
        );

        const selectedGroup = user?.selectedGroup;
        const findGroup = user?.groups?.find(
          (g) => g.groupName === selectedGroup
        );

        if (!selectedGroup) {
          bot.sendMessage(chatId, "Ошибка! Группа не найдена у пользователя");
          return;
        }

        if (!findGroup) {
          bot.sendMessage(
            chatId,
            "Ошибка! Группа не найдена в базе у пользователя"
          );
          return;
        }

        switch (selectedOptionForAllGroups) {
          case "addIgnoredUsers":
            const entries = text.split(",").map((entry) => entry.trim());

            entries.forEach((username) => {
              findGroup?.ignoredUsers?.push(username);

              const statusMessage = user
                ? `Пользователь ${username} найден, значение установлено`
                : `Пользователь ${username}, не найден`;

              bot.sendMessage(chatId, statusMessage);
            });

            fs.writeFileSync(
              "./assets/data/users.json",
              JSON.stringify(users, null, "\t")
            );
            break;

          case "addFirstText":
            const formattedFirstText = text.replace(/(\r\n|\r|\n)/g, "\n");

            findGroup.firstText = formattedFirstText;
            fs.writeFileSync(
              "./assets/data/users.json",
              JSON.stringify(users, null, "\t")
            );
            bot.sendMessage(
              chatId,
              `Сообщение для группы ${selectedGroup} успешно установлено`
            );

            break;

          case "addLastText":
            const formattedLastText = text.replace(/(\r\n|\r|\n)/g, "\n");
            findGroup.lastText = formattedLastText;

            fs.writeFileSync(
              "./assets/data/users.json",
              JSON.stringify(users, null, "\t")
            );

            bot.sendMessage(
              chatId,
              `Сообщение для группы ${selectedGroup} успешно установлено`
            );
            break;

          case "changeButtons":
            const commaCount = (text.match(/,/g) || []).length;
            if (commaCount !== 2) {
              bot.sendMessage(
                chatId,
                "Ошибка формата. Введите кнопки в нужном формате."
              );
              return;
            }

            const formattedButtonsText = text.replace(/(\r\n|\r|\n)/g, "\n");

            const [button1, button2, link] = formattedButtonsText
              .split(",")
              .map((part) => part.trim());

            const buttonData1 = { text: button1 };
            const buttonData2 = { text: button2, url: link };

            findGroup.buttons = [buttonData1, buttonData2];

            fs.writeFileSync(
              "./assets/data/users.json",
              JSON.stringify(users, null, "\t")
            );

            bot.sendMessage(
              chatId,
              `Кнопки для группы ${selectedGroup} успешно установлены`
            );
            break;

          default:
            bot.sendMessage(chatId, "Ошибка при выборе группы.");
            break;
        }
      });

      bot.removeListener("message", changeAll);
    }
  }

  function checkPaymentStatus(query) {
    const getUser = JSON.parse(fs.readFileSync("./assets/data/users.json"));

    if (query.includes("cancelPaymentId:")) {
      const paymentId = query.split(":")[1];

      const userWithPaymentId = getUser.find((x) => x.id === Number(paymentId));

      if (userWithPaymentId) {
        userWithPaymentId.haveSub = false;
        userWithPaymentId.subDays = null;

        fs.writeFileSync(
          "./assets/data/users.json",
          JSON.stringify(getUser, null, "\t")
        );

        bot.sendMessage(userWithPaymentId.id, `Подписка отклонена!`);

        bot.sendMessage(
          process.env.ADMIN_CHAT_ID,
          `Вы успешно отклонили оплату для ${userWithPaymentId.name}!\nПользователю был отправлен ответ`
        );
      }
    } else if (query.includes("confirmPaymentId:")) {
      const paymentId = query.split(":")[1];

      const userWithPaymentId = getUser.find((x) => x.id === Number(paymentId));

      if (userWithPaymentId) {
        userWithPaymentId.haveSub = true;
        userWithPaymentId.subDays = 30;

        fs.writeFileSync(
          "./assets/data/users.json",
          JSON.stringify(getUser, null, "\t")
        );

        bot.sendMessage(
          userWithPaymentId.id,
          `Подписка проверена и оплачена! Срок действия 30 дней. Для активации пропишите /start`
        );

        bot.sendMessage(
          TESTMODE ? process.env.TEST_ADMIN_CHAT_ID : process.env.ADMIN_CHAT_ID,
          `Вы успешно приняли оплату для ${userWithPaymentId.name}!\nПользователю была направлена инструкция`
        );
      }
    }
  }

  function checkSelectedGroup(query, chatId, messageId) {
    if (query.includes("SG:")) {
      const extractData = query.split(":")[1].split(",");

      const getUserGroups = JSON.parse(
        fs.readFileSync("./assets/data/users.json")
      );
      let user = getUserGroups.filter((x) => x.id === chatId)[0];

      switch (extractData[1]) {
        case "addIgnoredUsers":
          const addIgnoredUsersText = `Введите пользователей которых хотите игнорировать в этой группе через запятую пример:\nПользователь1, Пользователь2`;
          bot.sendMessage(chatId, addIgnoredUsersText);
          user.selectedGroup = extractData[0];

          fs.writeFileSync(
            "./assets/data/users.json",
            JSON.stringify(getUserGroups, null, "\t")
          );

          bot.on("message", handleAddIgnoredUsers);
          break;

        case "addFirstText":
          const addFirstText = `Введите текст который хотите добавить в группу пример:\nПривет\n\nМир!`;
          bot.sendMessage(chatId, addFirstText);
          user.selectedGroup = extractData[0];

          fs.writeFileSync(
            "./assets/data/users.json",
            JSON.stringify(getUserGroups, null, "\t")
          );

          bot.on("message", handleAddFirstText);

          break;

        case "addLastText":
          const addLastText = `Введите текст который хотите добавить в группу пример:\nПривет\nМир!`;

          bot.sendMessage(chatId, addLastText);
          user.selectedGroup = extractData[0];

          fs.writeFileSync(
            "./assets/data/users.json",
            JSON.stringify(getUserGroups, null, "\t")
          );

          bot.on("message", handleAddLastText);

          break;

        case "changeButtons":
          const changeButtonsText = `Введите кнопки в формате:\n(текст), (текст), ссылка\n\nПример:\nНе коммерческое, Админ, https://t.me/admin`;
          bot.sendMessage(chatId, changeButtonsText);
          user.selectedGroup = extractData[0];

          fs.writeFileSync(
            "./assets/data/users.json",
            JSON.stringify(getUserGroups, null, "\t")
          );

          bot.on("message", handleChangeButtons);
          break;

        default:
          bot.sendMessage(chatId, "Ошибка при выборе группы.");
          break;
      }
    } else if (query.includes("changeForAll:")) {
      const extractData = query.split(":")[1];

      const getUserGroups = JSON.parse(
        fs.readFileSync("./assets/data/users.json")
      );
      let user = getUserGroups.filter((x) => x.id === chatId)[0];

      user.selectedOptionForAllGroups = extractData;
      user.selectedAllGroups = [];

      fs.writeFileSync(
        "./assets/data/users.json",
        JSON.stringify(getUserGroups, null, "\t")
      );

      const availableGroups = user?.groups?.map((g) => [
        {
          text: g.groupName,
          callback_data: `selectGroupForAllChanges:${g.groupName}`,
        },
      ]);

      if (!availableGroups.length) {
        bot.sendMessage(chatId, "У вас ещё нет добавленных групп");
        return;
      }

      if (extractData) {
        bot.sendMessage(chatId, "Выберете группы", {
          reply_markup: JSON.stringify({
            inline_keyboard: [
              [
                {
                  text: "Применить для всех групп",
                  callback_data: `changeAll`,
                },
              ],
              ...availableGroups,
            ],
          }),
        });
      } else {
        bot.sendMessage(chatId, "Ошибка при отправке списка групп.");
      }
    } else if (query.includes("selectGroupForAllChanges:")) {
      const selectedGroup = query.split(":")[1];

      const getUserGroups = JSON.parse(
        fs.readFileSync("./assets/data/users.json")
      );
      let user = getUserGroups.filter((x) => x.id === chatId)[0];

      const availableGroups = user?.groups?.map((g) => [
        {
          text: user.selectedAllGroups.includes(g.groupName)
            ? `${g.groupName} ✅`
            : g.groupName,
          callback_data: `selectGroupForAllChanges:${g.groupName}`,
        },
      ]);

      if (!availableGroups.length) {
        bot.sendMessage(chatId, "У вас ещё нет добавленных групп");
        return;
      }

      bot.deleteMessage(chatId, messageId);

      const selectedAllGroups = user.selectedAllGroups;

      const checkCopy = selectedAllGroups.find((g) => g === selectedGroup);

      if (checkCopy) {
        const newAvailableGroups = user?.groups?.map((g) => [
          {
            text: user.selectedAllGroups.includes(g.groupName)
              ? `${g.groupName} ✅`
              : g.groupName,
            callback_data: `selectGroupForAllChanges:${g.groupName}`,
          },
        ]);

        bot.sendMessage(chatId, `Группа ${checkCopy} уже выбрана`, {
          reply_markup: JSON.stringify({
            inline_keyboard: [
              [
                {
                  text: "Применить для всех групп",
                  callback_data: `changeAll`,
                },
              ],
              ...newAvailableGroups,
            ],
          }),
        });
      } else {
        if (selectedGroup) {
          selectedAllGroups.push(selectedGroup);
          fs.writeFileSync(
            "./assets/data/users.json",
            JSON.stringify(getUserGroups, null, "\t")
          );

          const newAvailableGroups = user?.groups?.map((g) => [
            {
              text: user.selectedAllGroups.includes(g.groupName)
                ? `${g.groupName} ✅`
                : g.groupName,
              callback_data: `selectGroupForAllChanges:${g.groupName}`,
            },
          ]);

          bot.sendMessage(
            chatId,
            `Группа ${selectedGroup} успешно выбрана\nВсего выбранно ${selectedAllGroups?.length}`,
            {
              reply_markup: JSON.stringify({
                inline_keyboard: [
                  [
                    {
                      text: "Применить для всех групп",
                      callback_data: `changeAll`,
                    },
                  ],
                  ...newAvailableGroups,
                ],
              }),
            }
          );
        } else {
          bot.sendMessage(chatId, "Выбранная группа не найдена");
        }
      }
    } else if (query.includes("changeAll")) {
      const getUserGroups = JSON.parse(
        fs.readFileSync("./assets/data/users.json")
      );
      let user = getUserGroups.filter((x) => x.id === chatId)[0];

      const selectedGroups = user.selectedAllGroups;
      const selectedOptionForAllGroups = user.selectedOptionForAllGroups;

      bot.deleteMessage(chatId, messageId);
      if (!selectedGroups.length) {
        bot.sendMessage(chatId, "У вас ещё нет выбранных групп");
        return;
      } else if (!selectedOptionForAllGroups) {
        bot.sendMessage(chatId, "Вы ещё не выбрали опцию");
        return;
      }

      switch (selectedOptionForAllGroups) {
        case "addIgnoredUsers":
          const addIgnoredUsersText = `Введите пользователей которых хотите игнорировать во всех группах через запятую пример:\nПользователь1, Пользователь2`;
          bot.sendMessage(chatId, addIgnoredUsersText);

          bot.on("message", changeAll);
          break;

        case "addFirstText":
          const addFirstText = `Введите текст который хотите добавить для всех групп пример:\nПривет\n\nМир!`;
          bot.sendMessage(chatId, addFirstText);

          bot.on("message", changeAll);

          break;

        case "addLastText":
          const addLastText = `Введите текст который хотите добавить для всех групп пример:\nПривет\nМир!`;

          bot.sendMessage(chatId, addLastText);

          bot.on("message", changeAll);

          break;

        case "changeButtons":
          const changeButtonsText = `Введите кнопки в формате:\n(текст), (текст), ссылка\n\nПример:\nНе коммерческое, Админ, https: t.me/admin`;
          bot.sendMessage(chatId, changeButtonsText);
          bot.on("message", changeAll);

          break;

        default:
          bot.sendMessage(chatId, "Ошибка при выборе группы.");
          break;
      }
    }
  }

  bot.on("message", (msg) => {
    if (msg?.left_chat_member || msg?.new_chat_members) {
      return;
    }

    const command = msg.text;
    const chatId = msg.chat.id;
    const { type } = msg.chat;
    const { message_id } = msg;
    const getUsers = JSON.parse(fs.readFileSync("./assets/data/users.json"));
    let user = getUsers.filter((x) => x.id === msg.from.id)[0];

    if (!user) {
      const admin =
        chatId ===
        Number(
          TESTMODE ? process.env.TEST_ADMIN_CHAT_ID : process.env.ADMIN_CHAT_ID
        );

      getUsers.push({
        id: msg.from.id,
        nick: msg.from.username,
        name: msg.from.first_name,
        groups: [],
        haveSub: admin ? true : false,
        subDays: admin ? 30 : null,
      });

      user = getUsers.filter((x) => x.id === msg.from.id)[0];
      fs.writeFileSync(
        "./assets/data/users.json",
        JSON.stringify(getUsers, null, "\t")
      );
    }

    const superGroupName = msg.chat?.username;
    const availableGroups = JSON.parse(
      fs.readFileSync("./assets/data/users.json")
    );

    const foundUser = availableGroups.find((user) =>
      user?.groups?.some((group) => superGroupName === group?.groupName)
    );

    groupLogger.info(
      `step: 1:name:${superGroupName}:type:${type}:isBot:${msg.from.is_bot}:founderObject:${foundUser?.id}:fromObject:${msg.from.id}\n`
    );

    console.log(`\n${superGroupName} ${type}, ${msg.from.is_bot}, ${foundUser}`);
    if (
      type === "supergroup" &&
      !msg.from.is_bot &&
      foundUser?.id !== msg.from.id
    ) {
      console.log("hrere 1");
      if (foundUser) {
        const foundGroup = foundUser?.groups?.find(
          (group) => group?.groupName === superGroupName
        );
        console.log("hrere 2");

        const acceptedStatus = foundGroup?.ignoredUsers?.includes(
          user?.nick || user?.name
        );

        groupLogger.info(
          `step: 2:name:${superGroupName}:type:${type}:isBot:${msg.from.is_bot}:acceptedStatus:${acceptedStatus}:foundGroup:${foundGroup?.groupName}\n`
        );

        console.log("\n");
        console.log(user);
        console.log(foundGroup?.ignoredUsers, superGroupName);
        console.log(acceptedStatus);
        console.log("\n");

        if (!acceptedStatus) {
          const defaultFirstText = `Здравствуйте, ${
            user?.nick ? "@" + user?.nick : user?.name
          }, если у Вас не коммерческое объявление нажмите кнопку «Не коммерческое» и опубликуйте повторно.\n\nЕсли у Вас коммерческое объявление нажмите кнопку Админ\n\n❗️❗️❗️Если Вы опубликуете коммерческое объявление не согласовав с Администратором группы, получите вечный БАН`;

          const firstGroupText = foundGroup?.firstText
            ? `Здравствуйте, ${user?.nick ? "@" + user?.nick : user?.name}, ${
                foundGroup?.firstText
              }`
            : defaultFirstText;

          const groupAdminButtonURL = foundGroup?.buttons?.[1]?.url;
          const groupAdminButtonText = foundGroup?.buttons?.[1]?.text;

          const groupNoProfitButtonText = foundGroup?.buttons?.[0]?.text;

          bot.deleteMessage(chatId, message_id);

          bot
            .sendMessage(chatId, firstGroupText, {
              reply_markup: JSON.stringify({
                inline_keyboard: [
                  [
                    {
                      text: groupNoProfitButtonText || "Не коммерческое",
                      callback_data: `nonProfit`,
                    },
                  ],
                  [
                    {
                      text: groupAdminButtonText || "Админ",
                      callback_data: `admin`,
                      url: groupAdminButtonURL || process.env.ADMIN_URL,
                    },
                  ],
                ],
              }),
            })
            .then(({ message_id }) => {
              setTimeout(() => {
                bot.deleteMessage(chatId, message_id);
              }, 120000);
            });
        }
      }
    }

    switch (command) {
      case "/start":
        if (user?.haveSub) {
          bot.sendMessage(chatId, "Вы подписаны", {
            reply_markup: {
              keyboard: [
                ["Добавить группы", "Добавить людей в игнор"],
                ["Добавить текст для первого сообщения в группе"],
                ["Добавить текст для второго сообщения в группе"],
                ["Изменения кнопок"],
                ["Связь с разработчиком", "База знаний"],
              ],
              resize_keyboard: true,
            },
          });
        } else {
          bot.sendMessage(chatId, "Вы не подписаны", {
            reply_markup: {
              keyboard: [
                ["База знаний"],
                ["Тестовый режим (3) дня", "Купить доступ"],
              ],
              resize_keyboard: true,
            },
          });
        }
        break;

      case "/stop":
        if (
          user?.id ===
          Number(
            TESTMODE
              ? process.env.TEST_ADMIN_CHAT_ID
              : process.env.ADMIN_CHAT_ID
          )
        ) {
          stopBot();
        } else {
          bot.sendMessage(chatId, "Вы не админ");
        }

        break;

      case "/restart":
        if (
          user?.id ===
          Number(
            TESTMODE
              ? process.env.TEST_ADMIN_CHAT_ID
              : process.env.ADMIN_CHAT_ID
          )
        ) {
          restartBot();
        } else {
          bot.sendMessage(chatId, "Вы не админ");
        }

        break;

      case "База знаний":
        const baseInfoText = `${
          user?.nick ? `@${user?.nick}` : user?.name
        }, На нашем канале вы найдете базу знаний`;
        bot.sendMessage(chatId, baseInfoText, {
          reply_markup: JSON.stringify({
            inline_keyboard: [
              [
                {
                  text: "Перейти на канал",
                  callback_data: `baseInfo`,
                  url: process.env.CHANNEL_NAME,
                },
              ],
            ],
          }),
        });

        break;

      case "Тестовый режим (3) дня":
        if (type !== "supergroup") {
          if (user?.testActive) {
            const testSubModeText = `${
              user?.nick ? `@${user?.nick}` : user?.name
            }, Вы ранее уже активировали трех дневный тестовый режим`;
            bot.sendMessage(chatId, testSubModeText);
          } else {
            user.haveSub = true;
            user.testActive = true;
            user.subDays = 3;

            fs.writeFileSync(
              "./assets/data/users.json",
              JSON.stringify(getUsers, null, "\t")
            );

            const testSubModeText = `${
              user?.nick ? `@${user?.nick}` : user?.name
            }, Мы активировали трех дневный тестовый режим. Что бы продолжить нажмите /start`;
            bot.sendMessage(chatId, testSubModeText);
          }
        } else {
          bot.sendMessage(
            chatId,
            `Команда ${command} доступна только в лс с ботом!`
          );
        }
        break;

      case "Купить доступ":
        if (type === "private") {
          const buySubText = `${
            user?.nick ? `@${user?.nick}` : user?.name
          }, Реквизиты:\n\n5536914033399514\nТинькофф\n\nПосле оплаты отправьте скриншот в формате jpg, png`;
          bot.sendMessage(chatId, buySubText);
          bot.on("photo", handleSendReceipt);
        } else {
          bot.sendMessage(
            chatId,
            `Команда ${command} доступна только в лс с ботом!`
          );
        }
        break;

      case "Связь с разработчиком":
        const contactWithCreatorText = `${process.env.ADMIN_URL}`;
        bot.sendMessage(chatId, contactWithCreatorText);

        break;

      case "Добавить группы":
        if (type !== "supergroup") {
          if (user?.haveSub) {
            const text = `Введите канал, группы через запятую пример:\nГруппа1, Группа2`;
            bot.sendMessage(chatId, text);
            bot.on("message", handleAddGroups);
          } else {
            bot.sendMessage(chatId, "У вас нету подписки");
          }
        } else {
          bot.sendMessage(
            chatId,
            `Команда ${command} доступна только в лс с ботом!`
          );
        }

        break;

      case "Добавить людей в игнор":
        if (type !== "supergroup") {
          if (user?.haveSub) {
            selectGroup(chatId, command);
          } else {
            bot.sendMessage(chatId, "У вас нету подписки");
          }
        } else {
          bot.sendMessage(
            chatId,
            `Команда ${command} доступна только в лс с ботом!`
          );
        }

        break;

      case "Добавить текст для первого сообщения в группе":
        if (type !== "supergroup") {
          if (user?.haveSub) {
            selectGroup(chatId, command);
          } else {
            bot.sendMessage(chatId, "У вас нету подписки");
          }
        } else {
          bot.sendMessage(
            chatId,
            `Команда ${command} доступна только в лс с ботом!`
          );
        }

        break;

      case "Добавить текст для второго сообщения в группе":
        if (type !== "supergroup") {
          if (user?.haveSub) {
            selectGroup(chatId, command);
          } else {
            bot.sendMessage(chatId, "У вас нету подписки");
          }
        } else {
          bot.sendMessage(
            chatId,
            `Команда ${command} доступна только в лс с ботом!`
          );
        }

        break;

      case "Изменения кнопок":
        if (type !== "supergroup") {
          if (user?.haveSub) {
            selectGroup(chatId, command);
          } else {
            bot.sendMessage(chatId, "У вас нету подписки");
          }
        } else {
          bot.sendMessage(
            chatId,
            `Команда ${command} доступна только в лс с ботом!`
          );
        }

        break;

      default:
        break;
    }
  });

  bot.on("callback_query", (msg) => {
    const chatId = msg.from.id;
    const groupChatId = msg.message.chat.id;
    const messageId = msg.message.message_id;
    const query = msg.data;

    switch (query) {
      case "nonProfit":
        const superGroupName = msg.message?.chat?.username;
        const availableGroups = JSON.parse(
          fs.readFileSync("./assets/data/users.json")
        );

        const user = availableGroups.filter((x) => x.id === chatId)[0];

        const foundUser = availableGroups.find((user) =>
          user?.groups?.some((group) => superGroupName === group?.groupName)
        );

        if (foundUser && foundUser?.haveSub) {
          if (user?.nick || user?.name !== foundUser?.nick || foundUser?.name) {
            const foundGroup = foundUser?.groups?.find(
              (group) => group?.groupName === superGroupName
            );

            const acceptedStatus = foundGroup?.ignoredUsers?.includes(
              user?.nick || user?.name
            );

            if (!acceptedStatus) {
              const defaultLastText = `${
                user?.nick ? `@${user?.nick}` : user?.name
              }, Теперь у вас есть доступ к отправке сообщений\n\n❗️❗️❗️Если Вы опубликуете коммерческое объявление не согласовав с Администратором группы, получите вечный БАН`;

              const lastGroupText = foundGroup?.lastText
                ? `${user?.nick ? `@${user?.nick}` : user?.name}, ${
                    foundGroup?.lastText
                  }`
                : defaultLastText;

              foundGroup.ignoredUsers.push(
                user?.nick ? user?.nick : user?.name
              );

              fs.writeFileSync(
                "./assets/data/users.json",
                JSON.stringify(availableGroups, null, "\t")
              );

              bot
                .sendMessage(groupChatId, lastGroupText)
                .then(({ message_id }) => {
                  setTimeout(() => {
                    bot.deleteMessage(groupChatId, message_id);
                  }, 120000);
                });
            }
          }
        }

        break;

      default:
        checkPaymentStatus(query);
        checkSelectedGroup(query, chatId, messageId);
        break;
    }
  });

  cron.schedule("0 0 * * *", () => {
    const tempUsers = JSON.parse(fs.readFileSync("./assets/data/users.json"));
    tempUsers.forEach((item) => {
      if (!item.subDays) {
        item.haveSub = false;
        item.subDays = null;

        bot.sendMessage(item.id, "Ваша подписка истекла!");
      } else {
        item.subDays -= 1;
      }

      fs.writeFileSync(
        "./assets/data/users.json",
        JSON.stringify(tempUsers, null, "\t")
      );
    });
  });
} catch (error) {
  console.log("Have new error! Check in logs");
  errorLogger.error(error);
}

bot.on("polling_error", console.log);
