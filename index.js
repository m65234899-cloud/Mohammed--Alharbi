const { 
    Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, AttachmentBuilder 
} = require('discord.js');

// --- إعدادات البوت (تأكد من مطابقتها لسيرفرك) ---
const TOKEN = process.env.TOKEN; 
const LOG_CHANNEL_ID = "1461679281309614231"; // روم اللوج
const TICKET_CATEGORY_ID = "1337250897901912197"; // الكاتيجوري

const DEPARTMENTS = {
    support: { label: 'الدعم الفني', role: '1459353728233636022', emoji: '1472153518759612568' },
    admin: { label: 'الأداره العليا', role: '1462405819294290013', emoji: '1472153543917047951' },
    kick: { label: 'دعم الكيك', role: '1337252455901040772', emoji: '1472153524606472267' },
    event: { label: 'دعم الايفنت', role: '1465361030757617746', emoji: '1472153500333903893' }
};

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers
    ] 
});

client.once('ready', () => console.log(`✅ تم تشغيل البوت بنجاح: ${client.user.tag}`));

// --- معالجة أمر إنشاء التكت ---
client.on('messageCreate', async (message) => {
    // مصفوفة الأوامر لضمان الاستجابة مهما كتب المستخدم
    const triggers = ['!تكت', 'تكت', 'إتكت', '!إتكت', 'ticket'];
    
    if (triggers.includes(message.content.toLowerCase())) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

        const mainEmbed = new EmbedBuilder()
            .setTitle('__نظام التذاكر المطور__')
            .setDescription('مرحباً بك في مركز المساعدة، يرجى اختيار القسم المختص بمشكلتك من القائمة أسفله.')
            .setColor('#2b2d31')
            .setImage('https://cdn.discordapp.com/attachments/1458538054913359965/1464157760597004410/background.png');

        const menu = new StringSelectMenuBuilder()
            .setCustomId('ticket_select_menu')
            .setPlaceholder('🚀 اختر القسم المناسب...')
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

// --- معالجة التفاعلات داخل التكت ---
client.on('interactionCreate', async (interaction) => {
    // 1. عند اختيار قسم من القائمة
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select_menu') {
        const deptKey = interaction.values[0];
        const dept = DEPARTMENTS[deptKey];

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
                .setTitle(`لوحة التحكم - قسم ${dept.label}`)
                .setDescription(`مرحباً <@${interaction.user.id}>\nيرجى شرح مشكلتك هنا وسيقوم فريق <@&${dept.role}> بالرد عليك.`)
                .addFields(
                    { name: '👤 صاحب التكت:', value: `<@${interaction.user.id}>`, inline: true },
                    { name: '🛡️ الإدارة المسؤولة:', value: `<@&${dept.role}>`, inline: true }
                )
                .setColor('Blue');

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`claim_${deptKey}`).setLabel('استلام التكت').setStyle(ButtonStyle.Success).setEmoji('✅'),
                new ButtonBuilder().setCustomId('add_user').setLabel('إضافة شخص').setStyle(ButtonStyle.Primary).setEmoji('👤'),
                new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق التكت').setStyle(ButtonStyle.Danger).setEmoji('🔒')
            );

            await channel.send({ content: `<@${interaction.user.id}> | <@&${dept.role}>`, embeds: [panelEmbed], components: [row] });
            await interaction.reply({ content: `✅ تم فتح تذكرتك بنجاح: ${channel}`, ephemeral: true });

        } catch (error) {
            console.error(error);
            interaction.reply({ content: "❌ خطأ: تأكد من صلاحيات البوت وID الكاتيجوري.", ephemeral: true });
        }
    }

    // 2. معالجة الأزرار (استلام، إضافة، إغلاق)
    if (interaction.isButton()) {
        const channel = interaction.channel;
        const deptKey = Object.keys(DEPARTMENTS).find(k => channel.name.includes(DEPARTMENTS[k].label));
        const requiredRole = DEPARTMENTS[deptKey]?.role;

        // منع غير الإداريين من استخدام الأزرار
        if (!interaction.member.roles.cache.has(requiredRole) && !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({ content: '❌ هذا الزر مخصص لإدارة هذا القسم فقط!', ephemeral: true });
        }

        if (interaction.customId.startsWith('claim_')) {
            await interaction.reply({ content: `✅ تم استلام التكت بواسطة: <@${interaction.user.id}>` });
            const disabledRow = ActionRowBuilder.from(interaction.message.components[0]);
            disabledRow.components[0].setDisabled(true).setLabel('مستلمة');
            await interaction.message.edit({ components: [disabledRow] });
        }

        if (interaction.customId === 'add_user') {
            await interaction.reply({ content: 'أرسل ID الشخص الذي تريد إضافته الآن في الشات:', ephemeral: true });
            const filter = m => m.author.id === interaction.user.id;
            const collector = channel.createMessageCollector({ filter, max: 1, time: 30000 });

            collector.on('collect', async m => {
                const targetId = m.content.trim();
                try {
                    await channel.permissionOverwrites.edit(targetId, { ViewChannel: true, SendMessages: true });
                    await m.reply(`✅ تم إضافة <@${targetId}> بنجاح.`);
                } catch {
                    await m.reply("❌ عذراً، لم أتمكن من إضافة هذا الشخص (تأكد من الأيدي).");
                }
            });
        }

        if (interaction.customId === 'close_ticket') {
            await interaction.reply("🔒 جاري إغلاق التكت وحفظ السجل...");
            
            const messages = await channel.messages.fetch();
            const logContent = messages.reverse().map(m => `${m.author.tag}: ${m.content}`).join('\n');
            const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
            
            if (logChannel) {
                const attachment = new AttachmentBuilder(Buffer.from(logContent), { name: `log-${channel.name}.txt` });
                await logChannel.send({ content: `📝 سجل تكت مغلق: **${channel.name}**`, files: [attachment] });
            }

            setTimeout(() => channel.delete(), 5000);
        }
    }
});

client.login(TOKEN);
