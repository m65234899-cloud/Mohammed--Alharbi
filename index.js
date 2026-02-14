const { 
  Client, 
  GatewayIntentBits, 
  PermissionsBitField, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  StringSelectMenuBuilder 
} = require('discord.js');

const { TICKET_CATEGORY, LOG_CHANNEL, ROLES } = require('./config.json');

const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.MessageContent
  ] 
});

let ticketCounter = 1;
let claimedTickets = {}; // لتخزين من استلم التذكرة {channelId: userId}

client.once('clientReady', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// أمر !تكت
client.on('messageCreate', async (message) => {
  if (message.content === '!تكت') {
    const embed = new EmbedBuilder()
      .setTitle('__من هنا اختر التكت الخاص بمشكلتك__')
      .setImage('https://cdn.discordapp.com/attachments/1458538054913359965/1464157760597004410/background.png');

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('ticket_select')
      .setPlaceholder('اختر نوع التكت')
      .addOptions([
        { label: 'الدعم الفني', description: 'إذا مشكلتك خطاء فني او استفسار افتح هنا', value: 'support', emoji: '🛠️' },
        { label: 'الإدارة العليا', description: 'إذا كانت تواجهك مشكله قويه افتح هنا', value: 'admin', emoji: '🏛️' },
        { label: 'دعم الكيك', description: 'إذا صار في ظلم او شخص غلط عليك افتح هنا', value: 'kick', emoji: '⚔️' },
        { label: 'دعم الايفنت', description: 'استلام الجوائز من هنا او الاستفسار', value: 'event', emoji: '🎉' }
      ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);
    await message.channel.send({ embeds: [embed], components: [row] });
  }
});

// التعامل مع اختيار التكت
client.on('interactionCreate', async (interaction) => {

  // اختيار Select Menu
  if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
    const type = interaction.values[0];
    const roleId = ROLES[type];

    const channel = await interaction.guild.channels.create({
      name: `ticket-${ticketCounter}🎫`,
      type: 0,
      parent: TICKET_CATEGORY,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
        { id: roleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
      ],
    });

    ticketCounter++;

    await channel.send(`تم فتح تذكرتك <@${interaction.user.id}>! يرجى توضيح السبب.`);
    await interaction.reply({ content: `تم فتح تذكرتك هنا: <#${channel.id}>`, ephemeral: true });

    const ticketRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('claim_ticket').setLabel('استلام التذكرة ✅').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('add_user').setLabel('➕ إضافة شخص').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('unclaim_ticket').setLabel('💳 إلغاء الاستلام').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('remind_user').setLabel('📋 تذكير العميل').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('close_ticket').setLabel('⚠️ إغلاق التذكرة').setStyle(ButtonStyle.Danger)
    );

    await channel.send({ content: 'خيارات التذكرة 🎟️', components: [ticketRow] });
  }

  // التعامل مع الأزرار
  if (interaction.isButton()) {
    const btnId = interaction.customId;
    const channelId = interaction.channel.id;
    const ticketChannel = interaction.channel;

    switch (btnId) {
      case 'claim_ticket':
        if (claimedTickets[channelId]) {
          return interaction.reply({ content: `هذه التذكرة بالفعل مستلمة من قبل <@${claimedTickets[channelId]}>`, ephemeral: true });
        }
        claimedTickets[channelId] = interaction.user.id;
        await ticketChannel.permissionOverwrites.edit(
          interaction.guild.roles.everyone,
          { SendMessages: false }
        );
        await interaction.reply({ content: `تم استلام التذكرة من قبل <@${interaction.user.id}>`, ephemeral: true });
        break;

      case 'add_user':
        await interaction.reply({ content: 'أرسل ID الشخص ليتم إضافته', ephemeral: true });
        break;

      case 'unclaim_ticket':
        delete claimedTickets[channelId];
        await ticketChannel.permissionOverwrites.edit(
          interaction.guild.roles.everyone,
          { SendMessages: true }
        );
        await interaction.reply({ content: 'تم إلغاء الاستلام، يمكن لأي إداري آخر استلام التذكرة', ephemeral: true });
        break;

      case 'remind_user':
        await ticketChannel.send(`<@${interaction.user.id}> لديك تذكرة مفتوحة يرجى الرد!`);
        await interaction.reply({ content: 'تم تذكير العميل', ephemeral: true });
        break;

      case 'close_ticket':
        const logChannel = await interaction.guild.channels.fetch(LOG_CHANNEL);
        const messages = await ticketChannel.messages.fetch({ limit: 100 });
        const content = messages.map(m => `${m.author.tag}: ${m.content}`).join('\n');
        await logChannel.send(`تذكرة مغلقة: ${ticketChannel.name}\n${content}`);
        await ticketChannel.delete();
        break;
    }
  }
});

// توكن من Secret variable
client.login(process.env.TOKEN);
