const { Permissions, MessageEmbed, MessageButton, MessageActionRow, Client, Intents, ChannelType, Partials } = require("discord.js");
const config = require("./config.js");
const db = require("croxydb");

const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MEMBERS,
    Intents.FLAGS.GUILD_BANS,
    Intents.FLAGS.GUILD_EMOJIS_AND_STICKERS,
    Intents.FLAGS.GUILD_INTEGRATIONS,
    Intents.FLAGS.GUILD_WEBHOOKS,
    Intents.FLAGS.GUILD_INVITES,
    Intents.FLAGS.GUILD_VOICE_STATES,
    Intents.FLAGS.GUILD_PRESENCES,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
    Intents.FLAGS.GUILD_MESSAGE_TYPING,
    Intents.FLAGS.DIRECT_MESSAGES,
    Intents.FLAGS.DIRECT_MESSAGE_REACTIONS,
    Intents.FLAGS.DIRECT_MESSAGE_TYPING,
  ],
  partials: [
    "MESSAGE",
    "CHANNEL",
    "GUILD_MEMBER",
    "REACTION",
    "GUILD_SCHEDULED_EVENTS",
    "USER",
    "THREAD_MEMBER",
  ],
});

client.login(config.token || process.env.TOKEN);

client.on("ready", async () => {
  console.log("Bot is ready!");
  const channel = client.channels.cache.get(config.channel);
  if (!channel) return console.error("Specified channel not found.");

  const embed = new MessageEmbed()
    .setColor("#127896")
    .setAuthor("Redxy Ticket Bot", channel.guild.iconURL({ dynamic: true }))
    .setDescription("To create a support ticket, please select one of the buttons below.")
    .addFields(
      { name: '\u200B', value: '\u200B' },
      { name: "🎉 Create Ticket", value: "Opens a support ticket.", inline: true },
      { name: "⛔ Report User", value: "Reports a user.", inline: true }
    )
    .setThumbnail("https://cdn.discordapp.com/emojis/1071347093156921344.webp?size=96&quality=lossless")
    .setFooter("For support, click the Ticket", "https://cdn.discordapp.com/emojis/1071347093156921344.webp?size=96&quality=lossless");

  const row = new MessageActionRow()
    .addComponents(
      new MessageButton()
        .setLabel("Create Support Ticket")
        .setStyle("SECONDARY")
        .setCustomId("ticket_create")
        .setEmoji("🎫")
    );

  channel.send({ embeds: [embed], components: [row] });
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === "ticket_create") {
    const row = new MessageActionRow()
      .addComponents(
        new MessageButton()
          .setEmoji("🎉")
          .setStyle("SUCCESS")
          .setCustomId("ticket_open"),
        new MessageButton()
          .setEmoji("⛔")
          .setStyle("DANGER")
          .setCustomId("report_user")
      );

    const embed = new MessageEmbed()
      .setDescription("Which category do you want to select?")
      .setColor("#127896");

    interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  }

  if (interaction.customId === "ticket_open" || interaction.customId === "report_user") {
    await interaction.deferUpdate();

    const ticketCount = db.get(`ticket_${interaction.guild.id}`) || 1;

    interaction.guild.channels.create(`ticket-${ticketCount}`, {
      type: ChannelType.GUILD_TEXT,
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          deny: [Permissions.FLAGS.VIEW_CHANNEL],
        },
        {
          id: interaction.user.id,
          allow: [Permissions.FLAGS.VIEW_CHANNEL],
        },
        {
          id: config.staff,
          allow: [Permissions.FLAGS.VIEW_CHANNEL],
        },
      ],
    }).then((channel) => {
      const embed = new MessageEmbed()
        .setAuthor("Redxy Ticket Bot", interaction.guild.iconURL())
        .setDescription("Please explain your issue to the support team.")
        .addFields(
          { name: "User", value: interaction.user.tag, inline: true },
          { name: "Category", value: interaction.customId, inline: true },
          { name: "Ticket Number", value: ticketCount, inline: true }
        )
        .setColor("#127896");

      const row = new MessageActionRow()
        .addComponents(
          new MessageButton()
            .setLabel("Save and Close")
            .setStyle("SECONDARY")
            .setCustomId("close_ticket"),
          new MessageButton()
            .setLabel("Messages")
            .setStyle("SECONDARY")
            .setCustomId("view_messages")
        );

      db.set(`close_${channel.id}`, interaction.user.id);
      db.add(`ticket_${interaction.guild.id}`, 1);

      channel.send({ embeds: [embed], components: [row] }).then((msg) => {
        msg.pin();
      });
    });
  }
});

client.on("messageCreate", async (message) => {
  if (message.channel.name.includes("ticket")) {
    if (message.author.bot) return;
    db.push(`message_${message.channel.id}`, `${message.author.username}: ${message.content}`);
  }
});

client.on("interactionCreate", async (interaction) => {
  if (interaction.customId === "view_messages") {
    const fs = require("fs");
    const messages = db.get(`message_${interaction.channel.id}`);

    if (!messages) {
      fs.writeFileSync(`${interaction.channel.id}.json`, "No messages found in this channel!");
      interaction.reply({ files: [`./${interaction.channel.id}.json`] }).catch(console.error);
    } else {
      const data = messages.join("\n");
      fs.writeFileSync(`${interaction.channel.id}.json`, data);
      interaction.reply({ files: [`./${interaction.channel.id}.json`] }).catch(console.error);
    }
  }
});

client.on("interactionCreate", async (interaction) => {
  if (interaction.customId === "close_ticket") {
    const userId = db.fetch(`close_${interaction.channel.id}`);
    if (!userId) return;

    const channel = interaction.channel;
    channel.permissionOverwrites.edit(userId, { VIEW_CHANNEL: false });

    const embed = new MessageEmbed()
      .setDescription("This support ticket has been closed. We hope your issue has been resolved :)")
      .setColor("#127896");

    await interaction.reply({ embeds: [embed] });
  }
});

process.on("unhandledRejection", async (error) => {
  console.error("An error occurred:", error);
});
