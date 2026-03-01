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

bot.use((ctx, next) => {
    console.log(`--- Received Telegram event: ${ctx.updateType} ---`);
    return next();
});

bot.start((ctx) => {
    console.log(`Command /start received from user ${ctx.from.id}`);
    ctx.reply('Bot is active and ready to work!');
});

bot.on('chat_member', async (ctx) => {
    const update = ctx.chatMember;
    
    console.log(`chat_member event! Old status: ${update.old_chat_member.status}, New status: ${update.new_chat_member.status}`);

    const isJoined = update.old_chat_member.status !== 'member' && 
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

cron.schedule('* * * * *', async () => {
    console.log('Cron: Starting check for users who have been in the channel for 1 minute...');
    
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

bot.launch({
    allowedUpdates: ['chat_member', 'message']
})
    .then(() => console.log('Telegram bot successfully started'))
    .catch(err => console.error('Error starting bot:', err));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));