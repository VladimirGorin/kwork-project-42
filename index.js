require("dotenv").config({ path: "./assets/.env" });
const TelegramBotApi = require("node-telegram-bot-api");
const bot = new TelegramBotApi(process.env.TOKENTEST, { polling: true });
const cron = require("node-cron");
const fs = require("fs");

const {
  saveIgnoredUsers,
  saveNewGroupFirstText,
  saveNewGroupLastText,
  saveReceipt,
  saveGroups,
  stopBot,
  saveNewButtons,
} = require("./assets/modules/utils");
const commands = JSON.parse(fs.readFileSync("./assets/data/commands.json"));

bot.setMyCommands(commands);

function selectGroup(chatId, query) {
  let buttonQueryOption = null;
  const getUserGroups = JSON.parse(fs.readFileSync("./assets/data/users.json"));
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

  const availableGroups = user?.groups?.map((g) => [
    {
      text: g.groupName,
      callback_data: `selectedGroup:${g.groupName},${buttonQueryOption}`,
    },
  ]);

  if (!availableGroups.length) {
    bot.sendMessage(chatId, "У вас ещё нет добавленных групп");
    return;
  }

  if (buttonQueryOption) {
    bot.sendMessage(chatId, "Выберете группу", {
      reply_markup: JSON.stringify({
        inline_keyboard: availableGroups,
      }),
    });
  } else {
    bot.sendMessage(chatId, "Ошибка при отправке групп.");
  }
}

const handleAddGroups = (msg) => {
  saveGroups(msg, bot);
  bot.removeListener("message", handleAddGroups);
};

const handleSendReceipt = (msg) => {
  saveReceipt(msg, bot);
  bot.removeListener("message", handleSendReceipt);
};

const handleAddIgnoredUsers = (msg) => {
  saveIgnoredUsers(msg, bot);
  bot.removeListener("message", handleAddIgnoredUsers);
};

const handleAddLastText = (msg) => {
  saveNewGroupLastText(msg, bot);
  bot.removeListener("message", handleAddLastText);
};

const handleAddFirstText = (msg) => {
  saveNewGroupFirstText(msg, bot);
  bot.removeListener("message", handleAddFirstText);
};

const handleChangeButtons = (msg) => {
  saveNewButtons(msg, bot);
  bot.removeListener("message", handleChangeButtons);
};

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
        `Подписка проверена и оплачена! Срок действия 30 дней.`
      );

      bot.sendMessage(
        process.env.ADMIN_CHAT_ID,
        `Вы успешно приняли оплату для ${userWithPaymentId.name}!\nПользователю была направлена инструкция`
      );
    }
  }
}

function checkSelectedGroup(query, chatId) {
  if (query.includes("selectedGroup:")) {
    const extractData = query.split(":")[1].split(",");

    const getUserGroups = JSON.parse(
      fs.readFileSync("./assets/data/users.json")
    );
    let user = getUserGroups.filter((x) => x.id === chatId)[0];

    switch (extractData[1]) {
      case "addIgnoredUsers":
        const addIgnoredUsersText = `Введите пользователей которых хотите игнорировать во всех группах через запятую пример:\nПользователь1, Пользователь2`;
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
        const addLastText = `Введите текст который хотите добавить в группу пример:\nПривет\n\nМир!`;
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
  }
}

bot.on("message", (msg) => {
  const command = msg.text;
  const chatId = msg.chat.id;
  const { type } = msg.chat;
  const { message_id } = msg;
  const getUsers = JSON.parse(fs.readFileSync("./assets/data/users.json"));

  let user = getUsers.filter((x) => x.id === msg.from.id)[0];

  if (!user) {
    getUsers.push({
      id: msg.from.id,
      nick: msg.from.username,
      name: msg.from.first_name,
      heAcceptedAgreement: false,
      groups: [],
      haveSub: false,
      subDays: null,
    });

    user = getUsers.filter((x) => x.id === msg.from.id)[0];
    fs.writeFileSync(
      "./assets/data/users.json",
      JSON.stringify(getUsers, null, "\t")
    );
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
      if (user?.id === Number(process.env.ADMIN_CHAT_ID)) {
        stopBot();
      } else {
        bot.sendMessage(chatId, "Вы не админ");
      }

      break;

    case "База знаний":
      const baseInfoText = `@${user?.nick}, База знаний`;
      bot.sendMessage(chatId, baseInfoText);
      break;

    case "Тестовый режим (3) дня":
      if (user?.testActive) {
        const testSubModeText = `@${user?.nick}, Вы ранее уже активировали трех дневный тестовый режим`;
        bot.sendMessage(chatId, testSubModeText);
      } else {
        user.haveSub = true;
        user.testActive = true;
        user.subDays = 3;

        fs.writeFileSync(
          "./assets/data/users.json",
          JSON.stringify(getUsers, null, "\t")
        );

        const testSubModeText = `@${user?.nick}, Мы активировали трех дневный тестовый режим. Что бы продолжить нажмите /start`;
        bot.sendMessage(chatId, testSubModeText);
      }
      break;

    case "Купить доступ":
      const buySubText = `@${user?.nick}, Отправьте скриншот в формате jpg, png`;
      bot.sendMessage(chatId, buySubText);
      bot.on("photo", handleSendReceipt);
      break;

    case "Связь с разработчиком":
      const contactWithCreatorText = `${process.env.ADMIN_URL}`;
      bot.sendMessage(chatId, contactWithCreatorText);
      break;

    case "Добавить группы":
      if (user?.haveSub) {
        const text = `Введите канал, группы через запятую пример:\nГруппа1, Группа2`;
        bot.sendMessage(chatId, text);
        bot.on("message", handleAddGroups);
      } else {
        bot.sendMessage(chatId, "У вас нету подписки");
      }

      break;

    case "Добавить людей в игнор":
      if (user?.haveSub) {
        selectGroup(chatId, command);
      } else {
        bot.sendMessage(chatId, "У вас нету подписки");
      }

      break;

    case "Добавить текст для первого сообщения в группе":
      if (user?.haveSub) {
        selectGroup(chatId, command);
      } else {
        bot.sendMessage(chatId, "У вас нету подписки");
      }

      break;

    case "Добавить текст для второго сообщения в группе":
      if (user?.haveSub) {
        selectGroup(chatId, command);
      } else {
        bot.sendMessage(chatId, "У вас нету подписки");
      }

      break;

    case "Изменения кнопок":
      if (user?.haveSub) {
        selectGroup(chatId, command);
      } else {
        bot.sendMessage(chatId, "У вас нету подписки");
      }

      break;

    default:
      if (type === "supergroup") {
        const superGroupName = msg.chat?.username;
        const availableGroups = JSON.parse(
          fs.readFileSync("./assets/data/users.json")
        );

        const foundUser = availableGroups.find((user) =>
          user?.groups?.some((group) => superGroupName === group?.groupName)
        );

        if (foundUser) {
          if (foundUser.haveSub) {
            if (user.nick !== foundUser.nick) {
              if (!user.heAcceptedAgreement) {
                const foundGroup = foundUser?.groups?.find(
                  (group) => group?.groupName === superGroupName
                );
                const defaultFirstText = `Здравствуйте, ${
                  "@" + user?.nick || user?.name
                }, если у Вас не коммерческое объявление нажмите кнопку «Не коммерческое» и опубликуйте повторно.\n\nЕсли у Вас коммерческое объявление нажмите кнопку Админ\n\n❗️❗️❗️Если Вы опубликуете коммерческое объявление не согласовав с Администратором группы, получите вечный БАН`;

                const firstGroupText = foundGroup?.firstText
                  ? `Здравствуйте, ${"@" + user?.nick || user?.name}, ${
                      foundGroup?.firstText
                    }`
                  : defaultFirstText;

                const groupAdminButtonURL = foundGroup?.buttons?.[1]?.url;
                const groupAdminButtonText = foundGroup?.buttons?.[1]?.text;

                const groupNoProfitButtonText = foundGroup?.buttons?.[0]?.text;

                const checkIgnoredUsers = foundGroup?.ignoredUsers?.find(
                  (ignoredUser) => ignoredUser === user?.nick
                );

                if (!checkIgnoredUsers) {
                  bot.deleteMessage(chatId, message_id);
                  bot
                    .sendMessage(chatId, firstGroupText, {
                      reply_markup: JSON.stringify({
                        inline_keyboard: [
                          [
                            {
                              text:
                                groupNoProfitButtonText || "Не коммерческое",
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
          }
        }
      }

      break;
  }
});

bot.on("callback_query", (msg) => {
  const chatId = msg.from.id;
  const groupChatId = msg.message.chat.id;
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
        if (user?.nick !== foundUser?.nick) {
          if (!user?.heAcceptedAgreement) {
            const foundGroup = foundUser?.groups?.find(
              (group) => group?.groupName === superGroupName
            );
            const defaultLastText = `${
              `@${user?.nick}` || user?.name
            }, Теперь у вас есть доступ к отправке сообщений\n\n❗️❗️❗️Если Вы опубликуете коммерческое объявление не согласовав с Администратором группы, получите вечный БАН`;

            const lastGroupText = foundGroup?.lastText
              ? `${`@${user?.nick}` || user?.name}, ${foundGroup?.lastText}`
              : defaultLastText;

            user.heAcceptedAgreement = true;
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
      checkSelectedGroup(query, chatId);
      break;
  }
});

cron.schedule("0 0 * * *", () => {
  const tempUsers = JSON.parse(fs.readFileSync("./assets/data/users.json"));
  tempUsers.forEach((item) => {
    if (!item.subDays) {
      item.haveSub = false;
      item.subDays = null;
    } else {
      item.subDays -= 1;
    }

    fs.writeFileSync(
      "./assets/data/users.json",
      JSON.stringify(tempUsers, null, "\t")
    );
  });
});

bot.on("polling_error", console.log);
