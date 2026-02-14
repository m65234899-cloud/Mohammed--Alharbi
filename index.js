const { 
    Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, AttachmentBuilder 
} = require('discord.js');

// --- الإعدادات الأساسية ---
const TOKEN = process.env.TOKEN; 
const LOG_CHANNEL_ID = "1461679281309614231";
const TICKET_CATEGORY_ID = "1337250897901912197"; // تم وضع الأيدي الخاص بك هنا

const DEPARTMENTS = {
    support: { label: 'الدعم الفني', role: '1459353728233636022', emoji: '1472153518759612568' },
    admin: { label: 'الأداره العليا', role: '1462405819294290013', emoji: '1472153543917047951' },
    kick: { label: 'دعم الكيك', role: '1337252455901040772', emoji: '1472153524606472267' },
    event: { label: 'دعم الايفنت', role: '1465361030757617746', emoji: '1472153500333903893' }
};
// -----------------------

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers
    ] 
});

client.once('ready', () => {
    console.log(`✅ البوت شغال الآن باسم: ${client.user.tag}`);
});

// أمر !تكت
client.on('messageCreate', async (message) => {
    if (message.content === '!تكت') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

        const mainEmbed = new EmbedBuilder()
            .setTitle('__نظام التذاكر المطور__')
            .setDescription('مرحباً بك، يرجى اختيار القسم المناسب لمشكلتك من القائمة أدناه ليتم تحويلك للمسؤولين.')
            .setColor('#2b2d31')
            .setImage('https://cdn.discordapp.com/attachments/1458538054913359965/1464157760597004410/background.png');

        const menu = new StringSelectMenuBuilder()
            .setCustomId('ticket_select_menu')
            .setPlaceholder('🚀 اختر القسم المناسب من هنا...')
            .addOptions(Object.entries(DEPARTMENTS).map(([key, value]) => ({
                label: value.label,
                value: key,
                emoji: { id: value.emoji }
            })));

        await message.channel.send({ 
            embeds: [mainEmbed], 
            components: [new ActionRowBuilder().addComponents(menu)] 
        });
        await message.delete().catch(() => {});
    }
});

client.on('interactionCreate', async (interaction) => {
    // 1. فتح التذكرة
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select_menu') {
        const deptKey = interaction.values[0];
        const dept = DEPARTMENTS[deptKey];

        // منع فتح أكثر من تذكرة لنفس الشخص (اختياري)
        const check = interaction.guild.channels.cache.find(c => c.name === `${dept.label.toLowerCase().replace(/ /g, '-')}-${interaction.user.username.toLowerCase()}`);
        if (check) return interaction.reply({ content: `لديك تذكرة مفتوحة بالفعل في هذا القسم: ${check}`, ephemeral: true });

        try {
            const channel = await interaction.guild.channels.create({
                name: `${dept.label}-${interaction.user.username}`,
                parent: TICKET_CATEGORY_ID,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AttachFiles] },
                    { id: dept.role, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                ],
            });

            const panelEmbed = new EmbedBuilder()
                .setAuthor({ name: `قسم ${dept.label}`, iconURL: interaction.guild.iconURL() })
                .setDescription(`مرحباً <@${interaction.user.id}>\nالرجاء كتابة مشكلتك هنا بوضوح.\n\nسيتم الرد عليك من قبل فريق <@&${dept.role}>`)
                .addFields(
                    { name: '👤 العميل', value: `<@${interaction.user.id}>`, inline: true },
                    { name: '🛠️ القسم', value: `${dept.label}`, inline: true }
                )
                .setColor('Blue')
                .setTimestamp();

            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`claim_${deptKey}`).setLabel('استلام').setStyle(ButtonStyle.Success).setEmoji('✅'),
                new ButtonBuilder().setCustomId('add_member').setLabel('إضافة شخص').setStyle(ButtonStyle.Primary).setEmoji('👤'),
                new ButtonBuilder().setCustomId('remind_user').setLabel('تذكير').setStyle(ButtonStyle.Secondary).setEmoji('🔔'),
                new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق').setStyle(ButtonStyle.Danger).setEmoji('🔒')
            );

            await channel.send({ content: `<@${interaction.user.id}> | <@&${dept.role}>`, embeds: [panelEmbed], components: [buttons] });
            await interaction.reply({ content: `✅ تم فتح تذكرتك بنجاح: ${channel}`, ephemeral: true });

        } catch (e) {
            console.error(e);
            interaction.reply({ content: "❌ خطأ: تأكد أن البوت يمتلك صلاحية Manage Channels وأن الـ ID صحيح.", ephemeral: true });
        }
    }

    // 2. التحكم بالأزرار
    if (interaction.isButton()) {
        const channel = interaction.channel;
        const customId = interaction.customId;

        // استخراج الرتبة المطلوبة بناءً على اسم القناة أو القسم
        const deptKey = Object.keys(DEPARTMENTS).find(k => channel.name.includes(DEPARTMENTS[k].label));
        const requiredRole = DEPARTMENTS[deptKey]?.role;

        // حماية الأزرار للإدارة فقط
        if (!interaction.member.roles.cache.has(requiredRole) && !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({ content: '❌ هذا الزر مخصص لإدارة القسم فقط!', ephemeral: true });
        }

        if (customId.startsWith('claim_')) {
            await interaction.reply({ content: `✅ استلم التذكرة: <@${interaction.user.id}>` });
            // حذف زر الاستلام بعد الضغط
            const newButtons = ActionRowBuilder.from(interaction.message.components[0]);
            newButtons.components = newButtons.components.filter(c => c.data.custom_id !== customId);
            await interaction.message.edit({ components: [newButtons] });
        }

        if (customId === 'add_member') {
            await interaction.reply({ content: 'أرسل ID الشخص المراد إضافته الآن.', ephemeral: true });
            const collector = channel.createMessageCollector({ filter: m => m.author.id === interaction.user.id, max: 1, time: 20000 });
            collector.on('collect', async m => {
                const userId = m.content.trim();
                await channel.permissionOverwrites.edit(userId, { ViewChannel: true, SendMessages: true }).then(() => {
                    m.reply(`✅ تم إضافة <@${userId}> للتذكرة.`);
                }).catch(() => m.reply("❌ ايدي غير صحيح."));
            });
        }

        if (customId === 'remind_user') {
            await channel.send("🔔 **تذكير:** نرجو الرد على التذكرة لكي لا يتم إغلاقها لعدم التفاعل.");
            await interaction.reply({ content: 'تم الإرسال', ephemeral: true });
        }

        if (customId === 'close_ticket') {
            await interaction.reply("🔒 جاري إغلاق التذكرة وحفظ اللوجات...");
            
            const messages = await channel.messages.fetch();
            const logText = messages.reverse().map(m => `${m.author.tag}: ${m.content}`).join('\n');
            const attachment = new AttachmentBuilder(Buffer.from(logText), { name: `log-${channel.name}.txt` });

            const logChan = client.channels.cache.get(LOG_CHANNEL_ID);
            if (logChan) await logChan.send({ content: `📝 سجل تذكرة مغلقة: **${channel.name}**`, files: [attachment] });

            setTimeout(() => channel.delete(), 4000);
        }
    }
});

client.login(TOKEN);
