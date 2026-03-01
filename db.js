const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initDB() {
    const query = `
        CREATE TABLE IF NOT EXISTS channel_members (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            chat_id BIGINT NOT NULL,
            join_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, chat_id)
        );
    `;
    await pool.query(query);
    console.log('Database: Table channel_members is ready');
}

async function addUser(userId, chatId) {
    const query = `
        INSERT INTO channel_members (user_id, chat_id, join_date)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id, chat_id) 
        DO UPDATE SET join_date = CURRENT_TIMESTAMP;
    `;
    await pool.query(query, [userId, chatId]);
}

async function getExpiredUsers() {
    const query = `
        SELECT user_id, chat_id 
        FROM channel_members 
        WHERE join_date <= NOW() - INTERVAL '1 minute';
    `;
    const res = await pool.query(query);
    return res.rows;
}

async function removeUser(userId, chatId) {
    const query = `
        DELETE FROM channel_members 
        WHERE user_id = $1 AND chat_id = $2;
    `;
    await pool.query(query, [userId, chatId]);
}

module.exports = {
    initDB,
    addUser,
    getExpiredUsers,
    removeUser
};