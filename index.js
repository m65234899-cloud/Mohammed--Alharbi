const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  AttachmentBuilder,
} = require("discord.js");

// --- إعدادات البوت ---
const TOKEN = process.env.TOKEN;

const LOG_CHANNEL_ID = "1461679281309614231"; // روم اللوج
const TICKET_CATEGORY_ID = "1337250897901912197"; // كاتيجوري التكتات

// --- الأقسام ---
const DEPARTMENTS = {
  support: {
    label: "الدعم الفني",
    role: "1459353728233636022",
    emoji: "1472153518759612568",
  },
  admin: {
    label: "الإدارة العليا",
    role: "1462405819294290013",
    emoji: "1472153543917047951",
  },
  kick: {
    label: "دعم الكيك",
    role: "1337252455901040772",
    emoji: "1472153524606472267",
  },
  event: {
    label: "دعم الايفنت",
    role: "1465361030757617746",
    emoji: "1472153500333903893",
  },
};

// --- تشغيل البوت ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.once("ready", () => {
  console.log(`✅ البوت شغال: ${client.user.tag}`);
});

// =====================================================
// ✅ أمر القائمة !قائمة
// =====================================================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.content === "!قائمة") {
    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.Administrator
      )
    )
      return;

    const mainEmbed = new EmbedBuilder()
      .setTitle("🎫 نظام التذاكر المطور")
      .setDescription(
        "مرحباً بك في مركز المساعدة ✨\nاختر القسم المناسب من القائمة أسفل الرسالة."
      )
      .setColor("#2b2d31")
      .setImage(
        "https://cdn.discordapp.com/attachments/1458538054913359965/1464157760597004410/background.png"
      );

    const menu = new StringSelectMenuBuilder()
      .setCustomId("ticket_select_menu")
      .setPlaceholder("🚀 اختر القسم المناسب...")
      .addOptions(
        Object.entries(DEPARTMENTS).map(([key, value]) => ({
          label: value.label,
          value: key,
          emoji: { id: value.emoji },
        }))
      );

    await message.channel.send({
      embeds: [mainEmbed],
      components: [new ActionRowBuilder().addComponents(menu)],
    });

    await message.delete().catch(() => {});
  }
});

// =====================================================
// ✅ إنشاء التكت من القائمة
// =====================================================
client.on("interactionCreate", async (interaction) => {
  if (
    interaction.isStringSelectMenu() &&
    interaction.customId === "ticket_select_menu"
  ) {
    const deptKey = interaction.values[0];
    const dept = DEPARTMENTS[deptKey];

    try {
      const channel = await interaction.guild.channels.create({
        name: `ticket-${deptKey}-${interaction.user.username}`,
        parent: TICKET_CATEGORY_ID,

        topic: deptKey, // نخزن القسم هنا

        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: [PermissionsBitField.Flags.ViewChannel],
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.AttachFiles,
            ],
          },
          {
            id: dept.role,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
            ],
          },
        ],
      });

      const panelEmbed = new EmbedBuilder()
        .setTitle(`🎟️ تكت جديد - ${dept.label}`)
        .setDescription(
          `مرحباً <@${interaction.user.id}> ✨\nيرجى كتابة مشكلتك وسيتم الرد من الإدارة المختصة.`
        )
        .setColor("Blue");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("claim_ticket")
          .setLabel("استلام التكت")
          .setStyle(ButtonStyle.Success)
          .setEmoji("✅"),

        new ButtonBuilder()
          .setCustomId("add_user")
          .setLabel("إضافة شخص")
          .setStyle(ButtonStyle.Primary)
          .setEmoji("👤"),

        new ButtonBuilder()
          .setCustomId("close_ticket")
          .setLabel("إغلاق التكت")
          .setStyle(ButtonStyle.Danger)
          .setEmoji("🔒")
      );

      await channel.send({
        content: `<@${interaction.user.id}> | <@&${dept.role}>`,
        embeds: [panelEmbed],
        components: [row],
      });

      await interaction.reply({
        content: `✅ تم فتح تذكرتك بنجاح: ${channel}`,
        ephemeral: true,
      });
    } catch (err) {
      console.log(err);
      interaction.reply({
        content: "❌ خطأ: تأكد من صلاحيات البوت وID الكاتيجوري.",
        ephemeral: true,
      });
    }
  }

  // =====================================================
  // ✅ الأزرار داخل التكت
  // =====================================================
  if (interaction.isButton()) {
    const deptKey = interaction.channel.topic;
    const dept = DEPARTMENTS[deptKey];

    if (!dept) return;

    // تحقق الإدارة
    if (
      !interaction.member.roles.cache.has(dept.role) &&
      !interaction.member.permissions.has(
        PermissionsBitField.Flags.Administrator
      )
    ) {
      return interaction.reply({
        content: "❌ هذا الزر خاص بالإدارة فقط!",
        ephemeral: true,
      });
    }

    // ✅ استلام التكت
    if (interaction.customId === "claim_ticket") {
      await interaction.reply({
        content: `✅ تم استلام التكت بواسطة <@${interaction.user.id}>`,
      });

      const newRow = new ActionRowBuilder().addComponents(
        ButtonBuilder.from(
          interaction.message.components[0].components[0]
        )
          .setDisabled(true)
          .setLabel("مستلمة ✅"),

        ButtonBuilder.from(
          interaction.message.components[0].components[1]
        ),

        ButtonBuilder.from(
          interaction.message.components[0].components[2]
        )
      );

      await interaction.message.edit({ components: [newRow] });
    }

    // ✅ إضافة عضو
    if (interaction.customId === "add_user") {
      await interaction.reply({
        content: "👤 اكتب ID الشخص الآن:",
        ephemeral: true,
      });

      const filter = (m) => m.author.id === interaction.user.id;
      const collector = interaction.channel.createMessageCollector({
        filter,
        max: 1,
        time: 30000,
      });

      collector.on("collect", async (m) => {
        const targetId = m.content.trim();

        try {
          await interaction.guild.members.fetch(targetId);

          await interaction.channel.permissionOverwrites.edit(targetId, {
            ViewChannel: true,
            SendMessages: true,
          });

          await m.reply(`✅ تم إضافة <@${targetId}> بنجاح`);
        } catch {
          await m.reply("❌ ID غير صحيح أو العضو غير موجود.");
        }
      });
    }

    // ✅ إغلاق التكت + إرسال اللوق
    if (interaction.customId === "close_ticket") {
      await interaction.reply("🔒 جاري إغلاق التكت وحفظ السجل...");

      const fetched = await interaction.channel.messages.fetch({
        limit: 100,
      });

      const sorted = [...fetched.values()].sort(
        (a, b) => a.createdTimestamp - b.createdTimestamp
      );

      const logText = sorted
        .map((m) => `${m.author.tag}: ${m.content}`)
        .join("\n");

      const logChannel =
        interaction.guild.channels.cache.get(LOG_CHANNEL_ID);

      if (logChannel) {
        const file = new AttachmentBuilder(Buffer.from(logText), {
          name: `ticket-${interaction.channel.name}.txt`,
        });

        await logChannel.send({
          content: `📌 تم إغلاق التكت: **${interaction.channel.name}**`,
          files: [file],
        });
      }

      setTimeout(() => interaction.channel.delete(), 3000);
    }
  }
});

// =====================================================
client.login(TOKEN);
