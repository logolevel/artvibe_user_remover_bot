require('dotenv').config();
const { Telegraf } = require('telegraf');
const express = require('express');
const cron = require('node-cron');
const db = require('./db');

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();

db.initDB().catch(err => console.error('Database initialization error:', err));

const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot is running and tracking users!'));
app.listen(PORT, () => {
    console.log(`Express server is running on port ${PORT}`);
});

bot.on('chat_member', async (ctx) => {
    const update = ctx.chatMember;
    
    const isJoined = update.old_chat_member.status === 'left' && 
                     update.new_chat_member.status === 'member';

    if (isJoined) {
        const userId = update.new_chat_member.user.id;
        const chatId = ctx.chat.id;

        console.log(`User ${userId} joined channel ${chatId}`);
        
        try {
            await db.addUser(userId, chatId);
            console.log(`User ${userId} successfully added to DB`);
        } catch (error) {
            console.error(`Error adding user ${userId} to DB:`, error);
        }
    }
});

bot.start((ctx) => {
    console.log(`Command /start received from user ${ctx.from.id}`);
    ctx.reply('Привет! Бот активен. Я отслеживаю вступления в канал и удаляю пользователей спустя 2 месяца.');
});

cron.schedule('0 0 * * *', async () => {
    console.log('Cron: Starting check for users who have been in the channel for 2 months...');
    
    try {
        const expiredUsers = await db.getExpiredUsers();
        console.log(`Found users to remove: ${expiredUsers.length}`);

        for (const user of expiredUsers) {
            try {
                await bot.telegram.banChatMember(user.chat_id, user.user_id);
                await bot.telegram.unbanChatMember(user.chat_id, user.user_id);

                await db.removeUser(user.user_id, user.chat_id);
                
                console.log(`Success: User ${user.user_id} removed from channel ${user.chat_id}`);
            } catch (error) {
                console.error(`Error kicking user ${user.user_id}:`, error.description || error.message);
            }
            
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    } catch (error) {
        console.error('Error during cron job execution:', error);
    }
});

bot.launch()
    .then(() => console.log('Telegram bot successfully started'))
    .catch(err => console.error('Error starting bot:', err));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));