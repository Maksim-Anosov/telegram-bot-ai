import { Bot, Context, session, SessionFlavor } from 'grammy';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// API constants
const API_URL = "https://llm.chutes.ai/v1/chat/completions";
const MODEL = "deepseek-ai/DeepSeek-V3-0324";

// Get bot token from environment variables
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHUTES_API_TOKEN = process.env.CHUTES_API_TOKEN;

if (!BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN is not defined in environment variables');
}

if (!CHUTES_API_TOKEN) {
  throw new Error('CHUTES_API_TOKEN is not defined in environment variables');
}

// Define session interface
interface SessionData {
  conversationHistory: Array<{ role: string, content: string }>;
}

// Create context type with session flavor
type BotContext = Context & SessionFlavor<SessionData>;

// Initialize the bot
const bot = new Bot<BotContext>(BOT_TOKEN);

// Set up session middleware
bot.use(session({
  initial(): SessionData {
    return { conversationHistory: [] };
  },
}));

// Define bot commands for menu
const commands = [
  { command: "start", description: "Начать общение с ботом" }
];

// Set bot commands to be displayed in menu
bot.api.setMyCommands(commands);

// Function to make requests to DeepSeek AI
async function queryDeepSeek(messages: Array<{ role: string, content: string }>) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${CHUTES_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        "model": MODEL,
        "messages": messages,
        "stream": false,
        "max_tokens": 1024,
        "temperature": 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`API request failed: ${response.status} ${errorData}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Error querying DeepSeek AI:', error);
    throw error;
  }
}

// Handle the /start command
bot.command('start', async (ctx) => {
  await ctx.reply('Привет! Я бот, который использует DeepSeek AI для ответов на ваши вопросы. Просто напишите мне сообщение, и я отвечу.');
});

// Handle text messages
bot.on('message:text', async (ctx) => {
  const userMessage = ctx.message.text;
  
  // Send "Пишу ответ на Ваш запрос..." message
  const thinkingMessage = await ctx.reply('Пишу ответ на Ваш запрос...');
  
  try {
    // Add user message to conversation history
    ctx.session.conversationHistory.push({
      role: 'user',
      content: userMessage
    });
    
    // Get response from DeepSeek AI
    const aiResponse = await queryDeepSeek(ctx.session.conversationHistory);
    
    // Add AI response to conversation history
    ctx.session.conversationHistory.push({
      role: 'assistant',
      content: aiResponse
    });
    
    // Delete the "Пишу ответ на Ваш запрос..." message
    await ctx.api.deleteMessage(ctx.chat.id, thinkingMessage.message_id);
    
    // Send the AI response
    await ctx.reply(aiResponse);
  } catch (error) {
    console.error('Error processing message:', error);
    
    // Delete the "Пишу ответ на Ваш запрос..." message
    await ctx.api.deleteMessage(ctx.chat.id, thinkingMessage.message_id);
    
    // Send error message
    await ctx.reply('Произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте еще раз.');
  }
});

// Start the bot
bot.start();
console.log('Telegram bot started!');