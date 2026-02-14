const { 
    Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, AttachmentBuilder 
} = require('discord.js');

const config = {
    TOKEN: process.env.TOKEN, // تأكد من وضع التوكن في Variables الاستضافة
    LOG_CHANNEL: "1461679281309614231",
    TICKET_CATEGORY: "ضع_هنا_ايدي_الكاتيجوري", // ايدي الكاتيجوري اللي تنفتح فيه التذاكر
    DEPARTMENTS: {
        support: { label: 'الدعم الفني', role: '1459353728233636022', emoji: '1472153518759612568' },
        admin: { label: 'الأداره العليا', role: '1462405819294290013', emoji: '1472153543917047951' },
        kick: { label: 'دعم الكيك', role: '1337252455901040772', emoji: '1472153524606472267' },
        event: { label: 'دعم الايفنت', role: '1465361030757617746', emoji: '1472153500333903893' }
    }
};

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] });

client.once('ready', () => console.log(`✅ Ready as ${client.user.tag}`));

// رسالة التكت الرئيسية
client.on('messageCreate', async (message) => {
    if (message.content === '!تكت') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

        const embed = new EmbedBuilder()
            .setTitle('__نظام تذاكر الدعم الفني__')
            .setDescription('يرجى اختيار القسم المناسب لمشكلتك من القائمة أدناه.')
            .setColor('#2b2d31')
            .setImage('https://cdn.discordapp.com/attachments/1458538054913359965/1464157760597004410/background.png');

        const menu = new StringSelectMenuBuilder()
            .setCustomId('ticket_main_select')
            .setPlaceholder('اختر القسم من هنا...')
            .addOptions(Object.entries(config.DEPARTMENTS).map(([key, value]) => ({
                label: value.label,
                value: key,
                emoji: value.emoji
            })));

        await message.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] });
    }
});

client.on('interactionCreate', async (interaction) => {
    // 1. إنشاء التذكرة
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_main_select') {
        const deptKey = interaction.values[0];
        const dept = config.DEPARTMENTS[deptKey];

        const channel = await interaction.guild.channels.create({
            name: `${dept.label}-${interaction.user.username}`,
            parent: config.TICKET_CATEGORY,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                { id: dept.role, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
            ],
        });

        const panelEmbed = new EmbedBuilder()
            .setTitle(`قسم ${dept.label}`)
            .addFields(
                { name: '👤 صاحب التذكرة:', value: `<@${interaction.user.id}>`, inline: true },
                { name: '🛡️ الرتبة المسؤولة:', value: `<@&${dept.role}>`, inline: true }
            )
            .setDescription('سيقوم الفريق المختص بالرد عليك قريباً، يرجى كتابة مشكلتك بالتفصيل.')
            .setColor('Blue');

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`claim_${deptKey}`).setLabel('استلام').setStyle(ButtonStyle.Success).setEmoji('✅'),
            new ButtonBuilder().setCustomId('add_member').setLabel('اضافة شخص').setStyle(ButtonStyle.Primary).setEmoji('👤'),
            new ButtonBuilder().setCustomId('remind_user').setLabel('تذكير').setStyle(ButtonStyle.Secondary).setEmoji('🔔'),
            new ButtonBuilder().setCustomId('close_ticket').setLabel('اغلاق').setStyle(ButtonStyle.Danger).setEmoji('🔒')
        );

        await channel.send({ content: `<@${interaction.user.id}> | <@&${dept.role}>`, embeds: [panelEmbed], components: [buttons] });
        await interaction.reply({ content: `تم فتح تذكرتك بنجاح: ${channel}`, ephemeral: true });
    }

    // 2. معالجة الأزرار
    if (interaction.isButton()) {
        const customId = interaction.customId;
        const channel = interaction.channel;

        // التحقق من الرتبة (لازم يكون معاه رتبة القسم عشان يتحكم)
        const deptKey = Object.keys(config.DEPARTMENTS).find(k => channel.name.startsWith(config.DEPARTMENTS[k].label));
        const requiredRole = config.DEPARTMENTS[deptKey]?.role;

        if (customId.startsWith('claim_')) {
            if (!interaction.member.roles.cache.has(requiredRole)) {
                return interaction.reply({ content: 'عذراً، هذا الزر مخصص لإدارة هذا القسم فقط!', ephemeral: true });
            }
            await interaction.reply({ content: `✅ تم استلام التذكرة بواسطة: <@${interaction.user.id}>` });
            await interaction.message.edit({ components: [new ActionRowBuilder().addComponents(interaction.message.components[0].components.filter(c => c.customId !== customId))] });
        }

        if (customId === 'add_member') {
            if (!interaction.member.roles.cache.has(requiredRole)) return interaction.reply({ content: 'للمسؤولين فقط', ephemeral: true });
            
            await interaction.reply({ content: 'أرسل ID الشخص المراد إضافته الآن.', ephemeral: true });
            const collector = channel.createMessageCollector({ filter: m => m.author.id === interaction.user.id, max: 1, time: 20000 });
            
            collector.on('collect', async m => {
                await channel.permissionOverwrites.edit(m.content, { ViewChannel: true, SendMessages: true });
                m.reply(`تم إضافة <@${m.content}> بنجاح.`);
            });
        }

        if (customId === 'remind_user') {
            if (!interaction.member.roles.cache.has(requiredRole)) return interaction.reply({ content: 'للمسؤولين فقط', ephemeral: true });
            await channel.send('🔔 **تذكير:** يرجى الرد على التذكرة لكي لا يتم إغلاقها تلقائياً.');
            await interaction.reply({ content: 'تم الإرسال', ephemeral: true });
        }

        if (customId === 'close_ticket') {
            if (!interaction.member.roles.cache.has(requiredRole)) return interaction.reply({ content: 'للمسؤولين فقط', ephemeral: true });

            await interaction.reply('جاري حفظ السجلات وإغلاق التذكرة...');
            
            const messages = await channel.messages.fetch();
            const logText = messages.reverse().map(m => `${m.author.tag}: ${m.content}`).join('\n');
            const attachment = new AttachmentBuilder(Buffer.from(logText), { name: `transcript-${channel.name}.txt` });

            const logChannel = client.channels.cache.get(config.LOG_CHANNEL);
            if (logChannel) await logChannel.send({ content: `📝 سجل تذكرة مغلقة: **${channel.name}**`, files: [attachment] });

            setTimeout(() => channel.delete(), 5000);
        }
    }
});

client.login(config.TOKEN);
