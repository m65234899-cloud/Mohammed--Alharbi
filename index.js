const { Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { TOKEN, TICKET_CATEGORY, LOG_CHANNEL, ROLES } = require('./config.json');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

let ticketCounter = 1;
let claimedTickets = {}; // لتخزين من استلم التذكرة {channelId: userId}

client.on('clientReady', () => console.log(`Logged in as ${client.user.tag}`));

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
                { label: 'الدعم الفني', description: 'إذا مشكلتك خطأ فني او استفسار افتح هنا', value: 'support', emoji: { name: 'support', id: '1472021361189978206' } },
                { label: 'الإدارة العليا', description: 'إذا كانت تواجهك مشكلة قوية افتح هنا', value: 'admin', emoji: { name: 'admin', id: '1472021220479471696' } },
                { label: 'دعم الكيك', description: 'إذا صار ظلم أو شخص غلط عليك افتح هنا', value: 'kick', emoji: { name: 'kick', id: '1472021265614114962' } },
                { label: 'دعم الايفنت', description: 'استلام الجوائز أو استفسار افتح هنا', value: 'event', emoji: { name: 'event', id: '1472021260790923346' } }
            ]);

        const row = new ActionRowBuilder().addComponents(selectMenu);
        await message.channel.send({ embeds: [embed], components: [row] });
    }
});

// التعامل مع اختيار التكت
client.on('interactionCreate', async (interaction) => {
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

        // أول رسالة في التذكرة
        await channel.send({
            content: `تم فتح تذكرتك <@${interaction.user.id}>! يرجى توضيح السبب.\nالرجاء كتابة سبب فتح التذكرة:`,
        });

        // زر استلام التذكرة
        const ticketRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('claim_ticket').setLabel('استلام التذكرة ✅').setStyle(ButtonStyle.Success)
        );

        await channel.send({ content: 'اضغط على الزر أدناه لاستلام التذكرة', components: [ticketRow] });

        await interaction.reply({ content: `تم فتح التذكرة هنا: <#${channel.id}>`, ephemeral: true });
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

                // بعد الاستلام، أضف قائمة الخيارات الداخلية
                const internalMenu = new StringSelectMenuBuilder()
                    .setCustomId('ticket_options')
                    .setPlaceholder('اختر خيار التذكرة')
                    .addOptions([
                        { label: 'إضافة شخص', description: 'إضافة عضو آخر للتذكرة', value: 'add_user' },
                        { label: 'تذكير العميل', description: 'إرسال تذكير للعميل للرد', value: 'remind_user' },
                        { label: 'إغلاق التذكرة', description: 'إغلاق وحفظ محتوى التذكرة', value: 'close_ticket' },
                    ]);

                const internalRow = new ActionRowBuilder().addComponents(internalMenu);
                await ticketChannel.send({ content: `تم استلام التذكرة من قبل <@${interaction.user.id}>`, components: [internalRow] });

                await interaction.reply({ content: 'تم استلام التذكرة', ephemeral: true });
                break;
        }
    }

    // التعامل مع القائمة الداخلية بعد الاستلام
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_options') {
        const option = interaction.values[0];
        const ticketChannel = interaction.channel;

        switch (option) {
            case 'add_user':
                await interaction.reply({ content: 'أرسل ID الشخص ليتم إضافته', ephemeral: true });
                break;
            case 'remind_user':
                await ticketChannel.send(`تذكير: لديك تذكرة مفتوحة يرجى الرد!`);
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

client.login(TOKEN);
