const fs = require("fs");
const { exec } = require("child_process");

const saveGroups = (msg, bot) => {
  const chatId = msg.chat.id;
  const users = JSON.parse(fs.readFileSync("./assets/data/users.json"));
  const messageText = msg.text;

  const extractGroupNameFromLink = (link) => {
    const match = link.match(/https:\/\/t.me\/([^\s,]+)/);
    return match ? match[1] : null;
  };

  const links = messageText.match(/https:\/\/t.me\/([^\s,]+)/g) || [];
  const groupNamesFromLinks = links.map((link) =>
    extractGroupNameFromLink(link)
  );

  const groupNamesFromText = messageText
    .replace(/https:\/\/t.me\/([^\s,]+)/g, "")
    .split(",")
    .map((groupName) => groupName.trim());

  const groupNames = [...groupNamesFromLinks, ...groupNamesFromText].filter(
    Boolean
  );

  groupNames.forEach((groupName) => {
    const user = users.find((x) => x.id === chatId);

    if (user) {
      const existingGroup = users.some((u) =>
        u.groups.some((group) => group.groupName === groupName)
      );

      if (!existingGroup) {
        const userGroup = user.groups.find(
          (group) => group.groupName === groupName
        );

        if (userGroup) {
          bot.sendMessage(chatId, `Группа ${groupName} уже указана у вас.`);
        } else {
          user.groups.push({
            groupName,
            ignoredUsers: [],
            firstText: null,
            lastText: null,
            buttons: [],
          });

          fs.writeFileSync(
            "./assets/data/users.json",
            JSON.stringify(users, null, "\t")
          );

          bot.sendMessage(chatId, `Группа ${groupName} успешно установлена!`);
        }
      } else {
        bot.sendMessage(
          chatId,
          `Группа ${groupName} уже указана у другого пользователя.`
        );
      }
    } else {
      bot.sendMessage(
        chatId,
        "Пользователь не найден. Пожалуйста, зарегистрируйтесь или обратитесь к администратору."
      );
    }
  });
};
function saveIgnoredUsers(msg, bot) {
  const chatId = msg.chat.id;
  const usersData = JSON.parse(fs.readFileSync("./assets/data/users.json"));
  const text = msg.text;
  const user = usersData.filter((x) => x.id === chatId)[0];
  const selectedGroup = user?.selectedGroup;

  if (!selectedGroup) {
    bot.sendMessage(chatId, "Ошибка! Группа не найдена у пользователя");
    return;
  }
  const findGroup = user?.groups?.find((g) => g.groupName === selectedGroup);
  if (!findGroup) {
    bot.sendMessage(chatId, "Ошибка! Группа не найдена в базе у пользователя");
    return;
  }

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
    JSON.stringify(usersData, null, "\t")
  );
}

function saveNewGroupFirstText(msg, bot) {
  const chatId = msg.chat.id;
  const usersData = JSON.parse(fs.readFileSync("./assets/data/users.json"));
  const text = msg.text;
  const user = usersData.filter((x) => x.id === chatId)[0];
  const selectedGroup = user?.selectedGroup;

  if (!selectedGroup) {
    bot.sendMessage(chatId, "Ошибка! Группа не найдена у пользователя");
    return;
  }

  const findGroup = user?.groups?.find((g) => g.groupName === selectedGroup);
  if (!findGroup) {
    bot.sendMessage(chatId, "Ошибка! Группа не найдена в базе у пользователя");
    return;
  }

  const formattedText = text.replace(/(\r\n|\r|\n)/g, "\n");
  findGroup.firstText = formattedText;

  fs.writeFileSync(
    "./assets/data/users.json",
    JSON.stringify(usersData, null, "\t")
  );

  bot.sendMessage(
    chatId,
    `Сообщение для группы ${selectedGroup} успешно установлено`
  );
}

function saveNewGroupLastText(msg, bot) {
  const chatId = msg.chat.id;
  const usersData = JSON.parse(fs.readFileSync("./assets/data/users.json"));
  const text = msg.text;
  const user = usersData.filter((x) => x.id === chatId)[0];
  const selectedGroup = user?.selectedGroup;

  if (!selectedGroup) {
    bot.sendMessage(chatId, "Ошибка! Группа не найдена у пользователя");
    return;
  }

  const findGroup = user?.groups?.find((g) => g.groupName === selectedGroup);
  if (!findGroup) {
    bot.sendMessage(chatId, "Ошибка! Группа не найдена в базе у пользователя");
    return;
  }

  const formattedText = text.replace(/(\r\n|\r|\n)/g, "\n");
  findGroup.lastText = formattedText;

  fs.writeFileSync(
    "./assets/data/users.json",
    JSON.stringify(usersData, null, "\t")
  );

  bot.sendMessage(
    chatId,
    `Сообщение для группы ${selectedGroup} успешно установлено`
  );
}

function saveNewButtons(msg, bot) {
  const chatId = msg.chat.id;
  const usersData = JSON.parse(fs.readFileSync("./assets/data/users.json"));
  const text = msg.text;
  const user = usersData.filter((x) => x.id === chatId)[0];
  const selectedGroup = user?.selectedGroup;

  if (!selectedGroup) {
    bot.sendMessage(chatId, "Ошибка! Группа не найдена у пользователя");
    return;
  }

  const findGroup = user?.groups?.find((g) => g.groupName === selectedGroup);
  if (!findGroup) {
    bot.sendMessage(chatId, "Ошибка! Группа не найдена в базе у пользователя");
    return;
  }

  const commaCount = (text.match(/,/g) || []).length;
  if (commaCount !== 2) {
    bot.sendMessage(chatId, "Ошибка формата. Введите кнопки в нужном формате.");
    return;
  }

  const formattedText = text.replace(/(\r\n|\r|\n)/g, "\n");

  const [button1, button2, link] = formattedText
    .split(",")
    .map((part) => part.trim());

  const buttonData1 = { text: button1 };
  const buttonData2 = { text: button2, url: link };

  findGroup.buttons = [buttonData1, buttonData2];

  fs.writeFileSync(
    "./assets/data/users.json",
    JSON.stringify(usersData, null, "\t")
  );

  bot.sendMessage(chatId, `Кнопки для группы успешно установлены`);
}

function stopBot() {
  console.log("Stopping the bot...");

  exec("pm2 stop grootPersonal", (error, stdout, stderr) => {
    if (error) {
      console.error(`Error stopping the bot: ${error}`);
      return;
    }

    console.log("Bot stopped successfully.", stdout);
  });
}

function restartBot() {
  console.log("Restart the bot...");

  exec("pm2 restart grootPersonal", (error, stdout, stderr) => {
    if (error) {
      console.error(`Error stopping the bot: ${error}`);
      return;
    }

    console.log("Bot stopped successfully.", stdout);
  });
}

function saveReceipt(msg, bot, TESTMODE) {
  const chatId = msg.chat.id;
  const users = JSON.parse(fs.readFileSync("./assets/data/users.json"));

  if (msg.document) {
    const fileId = msg.document.file_id;
    const user = users.find((x) => x.id === chatId);

    if (!user) {
      console.error("User not found");
      return;
    }

    const filePath = `./assets/data/files/${msg.document.file_name}`;
    const fileStream = fs.createWriteStream(filePath);

    bot.getFileStream(fileId).pipe(fileStream);

    fileStream.on("error", (error) => {
      console.error(`Error downloading file: ${error}`);
    });

    fileStream.on("finish", () => {
      bot.sendMessage(
        chatId,
        `Информация о платеже принята и направлена администратору группы\nОжидайте проверки платежа.`
      );

      const adminChatId = TESTMODE
        ? process.env.TEST_ADMIN_CHAT_ID
        : process.env.ADMIN_CHAT_ID;
      if (adminChatId) {
        bot.sendDocument(adminChatId, filePath, {
          caption: `Платеж от @${user.nick}`,
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Подтвердить платеж",
                  callback_data: `confirmPaymentId:${user.id}`,
                },
              ],
              [
                {
                  text: "Отклонить платеж",
                  callback_data: `cancelPaymentId:${user.id}`,
                },
              ],
            ],
          },
        });
      } else {
        console.error("Admin chat ID not configured");
      }
    });
  } else if (msg.photo) {
    const fileId = msg.photo[msg.photo.length - 1].file_id;
    const user = users.find((x) => x.id === chatId);

    if (!user) {
      console.error("User not found");
      return;
    }

    const filePath = `./assets/data/files/${fileId}.jpg`;
    const fileStream = fs.createWriteStream(filePath);

    bot.getFileStream(fileId).pipe(fileStream);

    fileStream.on("error", (error) => {
      console.error(`Error downloading file: ${error}`);
    });

    fileStream.on("finish", () => {
      bot.sendMessage(
        chatId,
        `Информация о платеже принята и направлена администратору группы\nОжидайте проверки платежа.`
      );

      const adminChatId = TESTMODE
        ? process.env.TEST_ADMIN_CHAT_ID
        : process.env.ADMIN_CHAT_ID;

      if (adminChatId) {
        bot.sendPhoto(adminChatId, filePath, {
          caption: `Платеж от ${user.nick ? `@${user.nick}`: user.name}`,
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Подтвердить платеж",
                  callback_data: `confirmPaymentId:${user.id}`,
                },
              ],
              [
                {
                  text: "Отклонить платеж",
                  callback_data: `cancelPaymentId:${user.id}`,
                },
              ],
            ],
          },
        });
      } else {
        console.error("Admin chat ID not configured");
      }
    });
  }
}

module.exports = {
  saveIgnoredUsers,
  saveNewGroupFirstText,
  saveNewGroupLastText,
  saveNewButtons,
  saveReceipt,
  stopBot,
  saveGroups,
  restartBot,
};
