import { Api, JsonRpc } from 'eosjs';
import { JsSignatureProvider } from 'eosjs/dist/eosjs-jssig';
// import { Headers } from 'isomorphic-fetch';
// import fetch from 'node-fetch';
import fetch from 'isomorphic-fetch';
import { Client, Intents } from 'discord.js';
import * as redis from 'redis';
const { TextEncoder, TextDecoder } = require('util');

// import dotenv from "dotenv";
require("dotenv").config();

const REDIS_PORT = parseInt(process.env.REDIS_PORT);
const REDIS_HOST = process.env.REDIS_HOST;

export const redis_client = redis.createClient({
    socket: {
        port: REDIS_PORT,
        host: REDIS_HOST
    }
});

// REQUIRED configurations
// if (!process.env.ACTOR) throw new Error("process.env.ACTOR is required");
// if (!process.env.PRIVATE_KEYS) throw new Error("process.env.PRIVATE_KEYS is required");
export const ACTOR = process.env.ACTOR;
export const HEADERS = process.env.HEADERS;

// // wrap fetch
// function fetch(url: string, params = {} ) {
//     if ( !HEADERS ) return require('node-fetch')( url, params );
//     return require('node-fetch')(url, Object.assign(params, { headers: new Headers(JSON.parse(HEADERS)) }));
// }

// Discord
if (!process.env.DISCORD_TOKEN) throw new Error("process.env.DISCORD_TOKEN is required");
const DISCORD_TOKEN = process.env.DISCORD_TOKEN
export const client = new Client({ 
    intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.DIRECT_MESSAGES, Intents.FLAGS.GUILD_MESSAGE_REACTIONS, Intents.FLAGS.GUILD_VOICE_STATES, Intents.FLAGS.GUILD_SCHEDULED_EVENTS],
    partials: ['MESSAGE', 'CHANNEL', 'REACTION'],
});
client.login(DISCORD_TOKEN);

// EOSIO endpoints
export const EOSIO_CHAIN_ID = process.env.EOSIO_CHAIN_ID || 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906';
export const EOSIO_RPC = process.env.EOSIO_RPC || 'https://eos.greymass.com';
export const rpc = new JsonRpc(EOSIO_RPC, {fetch});
