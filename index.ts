import { rpc, client } from "./src/config";
import fs from "fs";
import { Message } from "discord.js"

client.on('ready', async listener => {
  console.log(`Logged in as ${listener.user.tag}!`);
});

// CONFIGURATIONS
const CHANNEL_IDS = [
  "927337249203445900", // #bot-testing
  // "906126857601155142"  // #stream-chat
]

const ADMIN_CHANNEL_IDS = [
  "927337249203445900", // #bot-testing
  // "906126857601155142"  // #stream-chat
]

function is_admin_channel(interaction: Message<boolean>)
{
  return ADMIN_CHANNEL_IDS.indexOf(interaction.channelId) != -1;
}

function is_channel(interaction: Message<boolean>)
{
  return CHANNEL_IDS.indexOf(interaction.channelId) != -1;
}

const USERS = new Map<string, string>();

const exists = fs.existsSync("discord.csv");
const writer = fs.createWriteStream("discord.csv", {flags: "a"});
if ( !exists ) writer.write("member.id,account,timestamp\n");

// load existsing users
for ( const row of fs.existsSync( "users.json" ) ? require("./users.json") : [] ) {
  USERS.set(row[0], row[1]);
}

async function is_account( account: string ) {
  try {
    await rpc.get_account(account);
    return true;
  } catch (e) {
    return false;
  }
}

client.on('messageCreate', async interaction => {
  for ( const word of interaction.content.split(" ")) {
    const pattern = word[0];
    const message = word.slice(1);
    if ( message.length > 12 ) continue;
    if ( ["$", "!"].indexOf(pattern) == -1 ) continue;
    await handle_message(interaction, pattern, message );
  }
});

function handle_message( interaction: Message<boolean>, pattern: string, message: string ) {
  if ( is_channel( interaction ) ) {
    if ( pattern == "$" ) return register_account( interaction, message );
    if ( pattern == "!" && message == "ping" ) return ping( interaction );
  }

  if ( is_admin_channel( interaction ) ) {
    if ( pattern == "!" && message == "list" ) return generate_list( interaction );
  }
}

async function ping( interaction: Message<boolean> ) {
  await interaction.reply(`🤖 pong!`);
}

async function generate_list( interaction: Message<boolean> ) {
  let message = `**Users**: \`${USERS.size}\`\n`
  message += Array.from(USERS.entries()).map(row => row[1]).join(',')
  if ( USERS.size ) await interaction.reply(message);
  else await interaction.reply("empty");
}

async function register_account( interaction: Message<boolean>, account: string ) {
  if ( !valid_account( account ) ) return;
  if ( !(await is_account(account)) ) {
    await interaction.react("🚫");
    return;
  }

  // same user
  if ( USERS.get( interaction.member.id ) == account ) {
    await interaction.reply(`⁉️ \`${account}\` already included in POP Token NFT snapshot (${USERS.size}) 🥳`);
  // existing user
  } else if ( USERS.has( interaction.member.id ) ) {
    await interaction.reply(`❓ \`${account}\` was replaced from POP Token NFT snapshot (${USERS.size}) 🥳`);
  // new user
  } else {
    await interaction.reply(`🎉 Congrats! \`${account}\` was added to POP Token NFT snapshot (${USERS.size + 1}) 🥳`);
  }
  // await interaction.react("🎉");
  USERS.set(interaction.member.id, account );
  writer.write([interaction.member.id, account, interaction.createdTimestamp].join(",") + "\n");
  fs.writeFileSync("users.json", JSON.stringify(Array.from(USERS.entries()), null, 4));
}

function valid_account( account: string ) {
  return RegExp(/^[a-z1-5\.]+$/).test( account );
}