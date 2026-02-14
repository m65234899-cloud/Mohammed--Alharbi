const { 
    Client, 
    GatewayIntentBits, 
    PermissionsBitField, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder,
    AttachmentBuilder
} = require('discord.js');
const { TOKEN, TICKET_CATEGORY, LOG_CHANNEL, ROLES } = require('./config.json');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ] 
});

// ملاحظة: يفضل استخدام قاعدة بيانات للمتغيرات أدناه
let ticketCounter = Date.now(); // استخدام الوقت لضمان عدم تكرار الرقم
let activeTickets = new Set(); 

client.once('ready', () => {
    console.log(`✅ تم تشغيل البوت بنجاح: ${client.user.tag}`);
});

// أمر إنشاء رسالة التذاكر
client.on('messageCreate', async (message) => {
    if (message.content === '!تكت') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

        const embed = new EmbedBuilder()
            .setTitle('__مركز الدعم والمساعدة__')
            .setDescription('يرجى اختيار القسم المناسب لمشكلتك من القائمة أدناه.')
            .setColor('#2b2d31')
            .setImage('https://cdn.discordapp.com/attachments/1458538054913359965/1464157760597004410/background.png');

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('ticket_select')
            .setPlaceholder('🚀 اختر نوع التذكرة...')
            .addOptions([
                { label: 'الدعم الفني', value: 'support', emoji: '🛠️' },
                { label: 'الإدارة العليا', value: 'admin', emoji: '👑' },
                { label: 'قسم الشكاوي', value: 'kick', emoji: '⚖️' },
                { label: 'جوائز الايفنتات', value: 'event', emoji: '🎁' }
            ]);

        const row = new ActionRowBuilder().addComponents(selectMenu);
        await message.channel.send({ embeds: [embed], components: [row] });
        await message.delete();
    }
});

client.on('interactionCreate', async (interaction) => {
    // 1. إنشاء التذكرة
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
        if (activeTickets.has(interaction.user.id)) {
            return interaction.reply({ content: 'لديك تذكرة مفتوحة بالفعل!', ephemeral: true });
        }

        const type = interaction.values[0];
        const roleId = ROLES[type];

        const channel = await interaction.guild.channels.create({
            name: `ticket-${interaction.user.username}`,
            type: 0,
            parent: TICKET_CATEGORY,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AttachFiles] },
                { id: roleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
            ],
        });

        activeTickets.add(interaction.user.id);

        const welcomeEmbed = new EmbedBuilder()
            .setTitle('تذكرة جديدة')
            .setDescription(`مرحباً <@${interaction.user.id}>، يرجى كتابة مشكلتك وسيقوم فريق <@&${roleId}> بالرد عليك قريباً.`)
            .setColor('Blue')
            .setTimestamp();

        const claimBtn = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('claim_ticket').setLabel('استلام التذكرة').setStyle(ButtonStyle.Success).setEmoji('✅')
        );

        await channel.send({ embeds: [welcomeEmbed], components: [claimBtn] });
        await interaction.reply({ content: `تم فتح تذكرتك بنجاح: ${channel}`, ephemeral: true });
    }

    // 2. التعامل مع الأزرار والقوائم داخل التذكرة
    if (interaction.isButton() || interaction.isStringSelectMenu()) {
        const ticketChannel = interaction.channel;

        if (interaction.customId === 'claim_ticket') {
            const internalMenu = new StringSelectMenuBuilder()
                .setCustomId('ticket_options')
                .setPlaceholder('إعدادات الإدارة')
                .addOptions([
                    { label: 'إضافة عضو', value: 'add_user', emoji: '👤' },
                    { label: 'تذكير العميل', value: 'remind_user', emoji: '🔔' },
                    { label: 'إغلاق وحفظ', value: 'close_ticket', emoji: '🔒' },
                ]);

            await interaction.update({ 
                content: `✅ تم استلام التذكرة بواسطة: <@${interaction.user.id}>`, 
                components: [new ActionRowBuilder().addComponents(internalMenu)] 
            });
        }

        if (interaction.customId === 'ticket_options') {
            const option = interaction.values[0];

            switch (option) {
                case 'add_user':
                    await interaction.reply({ content: 'من فضلك أرسل ID الشخص المراد إضافته الآن.' });
                    const collector = interaction.channel.createMessageCollector({ 
                        filter: m => m.author.id === interaction.user.id, 
                        max: 1, 
                        time: 30000 
                    });

                    collector.on('collect', async m => {
                        const userId = m.content;
                        try {
                            await ticketChannel.permissionOverwrites.edit(userId, { ViewChannel: true, SendMessages: true });
                            await m.reply(`تم إضافة <@${userId}> للتذكرة بنجاح.`);
                        } catch {
                            await m.reply('تأكد من كتابة ID صحيح.');
                        }
                    });
                    break;

                case 'remind_user':
                    await ticketChannel.send({ content: `🔔 تذكير للعميل: ننتظر ردك لإكمال المساعدة.` });
                    await interaction.reply({ content: 'تم الإرسال', ephemeral: true });
                    break;

                case 'close_ticket':
                    await interaction.reply('جاري إغلاق التذكرة وحفظ السجلات...');
                    
                    // إنشاء Transcript بسيط
                    const messages = await ticketChannel.messages.fetch({ limit: 100 });
                    const transcript = messages.reverse().map(m => `${m.author.tag}: ${m.content}`).join('\n');
                    const buffer = Buffer.from(transcript, 'utf-8');
                    const attachment = new AttachmentBuilder(buffer, { name: `transcript-${ticketChannel.name}.txt` });

                    const logChannel = client.channels.cache.get(LOG_CHANNEL);
                    if (logChannel) {
                        await logChannel.send({ 
                            content: `📄 سجل التذكرة: **${ticketChannel.name}**`, 
                            files: [attachment] 
                        });
                    }

                    // إزالة المستخدم من قائمة التذاكر النشطة
                    // ملاحظة: نحتاج لطريقة لجلب صاحب التذكرة الأصلي، هنا افترضنا الاسم
                    activeTickets.forEach(id => {
                        if (ticketChannel.name.includes(id)) activeTickets.delete(id);
                    });

                    setTimeout(() => ticketChannel.delete().catch(() => {}), 5000);
                    break;
            }
        }
    }
});

client.login(TOKEN);
