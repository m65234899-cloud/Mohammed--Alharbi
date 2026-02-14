const { Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { TOKEN, TICKET_CATEGORY, LOG_CHANNEL, ROLES, EMOJIS } = require('./config.json');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

let ticketCounter = 1;
let claimedTickets = {}; // لتخزين من استلم التذكرة {channelId: userId}

client.once('clientReady', () => console.log(`Logged in as ${client.user.tag}`));

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
                { label: 'الدعم الفني', description: 'إذا مشكلتك خطاء فني او استفسار افتح هنا', value: 'support', emoji: EMOJIS.support },
                { label: 'الإدارة العليا', description: 'إذا كانت تواجهك مشكله قويه افتح هنا', value: 'admin', emoji: EMOJIS.admin },
                { label: 'دعم الكيك', description: 'إذا صار في ظلم او شخص غلط عليك افتح هنا', value: 'kick', emoji: EMOJIS.kick },
                { label: 'دعم الايفنت', description: 'استلام الجوائز من هنا او الاستفسار', value: 'event', emoji: EMOJIS.event }
            ]);

        const row = new ActionRowBuilder().addComponents(selectMenu);
        await message.channel.send({ embeds: [embed], components: [row] });
    }
});

// التعامل مع اختيار التكت
client.on('interactionCreate', async (interaction) => {

    // Select Menu لاختيار نوع التكت
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
        const type = interaction.values[0];
        const roleId = ROLES[type];

        // إنشاء التذكرة
        const channel = await interaction.guild.channels.create({
            name: `ticket-${ticketCounter}🎫`,
            type: 0,
            parent: TICKET_CATEGORY,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
                { id: roleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
            ]
        });

        ticketCounter++;

        // أول رسالة داخل التذكرة: منشن للعميل + الاداري + زر استلام فقط
        const ticketRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('claim_ticket').setLabel('استلام التذكرة ✅').setStyle(ButtonStyle.Success)
        );

        await channel.send({
            content: `<@${interaction.user.id}> | <@&${roleId}>`,
            embeds: [
                new EmbedBuilder()
                    .setTitle('التذكرة الخاصة بك')
                    .setImage('https://cdn.discordapp.com/attachments/1458538054913359965/1464157760597004410/background.png')
            ],
            components: [ticketRow]
        });

        await interaction.reply({ content: `تم فتح تذكرتك هنا: <#${channel.id}>`, ephemeral: true });
    }

    // التعامل مع الأزرار
    if (interaction.isButton()) {
        const channelId = interaction.channel.id;
        const ticketChannel = interaction.channel;
        const btnId = interaction.customId;

        switch (btnId) {
            case 'claim_ticket':
                if (claimedTickets[channelId]) return interaction.reply({ content: `هذه التذكرة بالفعل مستلمة من قبل <@${claimedTickets[channelId]}>`, ephemeral: true });
                claimedTickets[channelId] = interaction.user.id;

                // إظهار باقي خيارات التذكرة كسيلكت بعد الاستلام
                const afterClaimMenu = new StringSelectMenuBuilder()
                    .setCustomId('ticket_options')
                    .setPlaceholder('اختر خيار من التذكرة')
                    .addOptions([
                        { label: '➕ إضافة شخص', value: 'add_user' },
                        { label: '💳 إلغاء الاستلام', value: 'unclaim_ticket' },
                        { label: '📋 تذكير العميل', value: 'remind_user' },
                        { label: '⚠️ إغلاق التذكرة', value: 'close_ticket' }
                    ]);

                const optionsRow = new ActionRowBuilder().addComponents(afterClaimMenu);
                await ticketChannel.send({ content: `تم استلام التذكرة من قبل <@${interaction.user.id}>. اختر خيار من التذكرة:`, components: [optionsRow] });
                await interaction.reply({ content: 'تم استلام التذكرة ✅', ephemeral: true });
                break;
        }
    }

    // التعامل مع خيارات التذكرة بعد الاستلام
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_options') {
        const value = interaction.values[0];
        const channelId = interaction.channel.id;
        const ticketChannel = interaction.channel;

        switch (value) {
            case 'add_user':
                await interaction.reply({ content: 'أرسل ID الشخص ليتم إضافته', ephemeral: true });
                break;
            case 'unclaim_ticket':
                delete claimedTickets[channelId];
                await ticketChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: true });
                await interaction.reply({ content: 'تم إلغاء الاستلام ✅', ephemeral: true });
                break;
            case 'remind_user':
                await ticketChannel.send(`لديك تذكرة مفتوحة يرجى الرد <@${interaction.user.id}>`);
                await interaction.reply({ content: 'تم تذكير العميل ✅', ephemeral: true });
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

client.login(TOKEN);
