import { rpc, client } from "./src/config";
import fs from "fs";
import { Message } from "discord.js"

client.on('ready', async listener => {
  console.log(`Logged in as ${listener.user.tag}!`);
});

// CONFIGURATIONS
const CHANNEL_IDS = [
  927337249203445900,
]

const exists = fs.existsSync("dicsord.csv");
const writer = fs.createWriteStream("discord.csv", {flags: "a"});
if ( !exists ) writer.write("discord,account,timestamp\n");

async function is_account( account: string ) {
  try {
    await rpc.get_account(account);
    return true;
  } catch (e) {
    return false;
  }
}

client.on('messageCreate', async interaction => {
  if ( CHANNEL_IDS.indexOf(Number(interaction.channelId)) == -1 ) return;

  for ( const word of interaction.content.split(" ")) {
    const pattern = word[0];
    const message = word.slice(1);
    if ( message.length > 12 ) continue;
    if ( pattern != "$" ) continue;
    await handle_message(interaction, pattern, message );
  }
});

function handle_message( interaction: Message<boolean>, pattern: string, message: string ) {
  if ( pattern == "$" ) return register_account( interaction, message );
}

async function register_account( interaction: Message<boolean>, account: string ) {
  if ( !valid_account( account ) ) return;;
  if ( !(await is_account(account)) ) return;
  await interaction.reply(`🎉 Congrats! \`${account}\` was added to POP NFT snapshot 🥳`);
  writer.write([interaction.member, account, interaction.createdAt].join(","));
}

function valid_account( account: string ) {
  return RegExp(/^[a-z1-5\.]+$/).test( account );
}