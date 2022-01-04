import { Client, Intents } from 'discord.js';
import dotenv from "dotenv"

dotenv.config();
if (!process.env.DISCORD_TOKEN) throw new Error("process.env.DISCORD_TOKEN is required");
const DISCORD_TOKEN = process.env.DISCORD_TOKEN

export const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.DIRECT_MESSAGES] });
client.login(DISCORD_TOKEN);
