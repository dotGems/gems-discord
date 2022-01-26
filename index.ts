import { rpc, client } from "./src/config";
import fs from "fs";
import { Message, MessageEmbed, CommandInteraction, CacheType } from "discord.js"
import { SlashCommandBuilder } from '@discordjs/builders';

client.on('ready', async listener => {
  console.log(`Logged in as ${listener.user.tag}!`);

  // commands
  await client.application.commands.create({name: "ping", description: "responds with ping", type: "CHAT_INPUT"}, "892385699616153600")
  await client.application.commands.create({name: "snapshot", description: "Generates POP Token snapshot", type: "CHAT_INPUT"}, "892385699616153600")
});

// CONFIGURATIONS
const CHANNEL_IDS = [
  "927337249203445900", // #bot-testing
  "906126857601155142"  // #stream-chat
]

const ADMIN_CHANNEL_IDS = [
  "927337249203445900", // #bot-testing
  "906126857601155142"  // #stream-chat
]

const POP_TOKEN_IMAGE = "https://ipfs.io/ipfs/QmZnZ4eCSWPNU2XkXT4Yn3LsCYXYgCPqgLVpqGBTEBzo91"

function is_admin_channel(interaction: Message<boolean>)
{
  return ADMIN_CHANNEL_IDS.indexOf(interaction.channelId) != -1;
}

function is_channel(interaction: Message<boolean>)
{
  return CHANNEL_IDS.indexOf(interaction.channelId) != -1;
}

const USERS = new Map<string, string>();

const filename_discord = `./snapshots/${ get_date() }-discord.csv`
const filename_users = `./snapshots/${ get_date() }-users.json`
const exists = fs.existsSync(filename_discord);
const writer = fs.createWriteStream(filename_discord, {flags: "a"});
if ( !exists ) writer.write("member.id,account,timestamp,date\n");

// load existsing users
for ( const row of fs.existsSync( filename_users ) ? require( filename_users ) : [] ) {
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

client.on('messageUpdate', async (previous, current: any)  => {
  if ( current.author.bot ) return;
  for ( const word of current.content.split(" ")) {
    const pattern = word[0];
    const message = word.slice(1);
    if ( message.length > 12 ) continue;
    if ( ["$", "!"].indexOf(pattern) == -1 ) continue;
    await handle_message(current, pattern, message );
  }
});

client.on('messageCreate', async interaction => {
  if ( interaction.author.bot ) return;
  for ( const word of interaction.content.split(" ")) {
    const pattern = word[0];
    const message = word.slice(1);
    if ( message.length > 12 ) continue;
    if ( ["$", "!"].indexOf(pattern) == -1 ) continue;
    await handle_message(interaction, pattern, message );
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;
	const { commandName } = interaction;

	if (commandName === 'ping') {
		await ping(interaction);
	} else if (commandName === 'snapshot') {
		await generate_snapshot(interaction);
	}
});

function handle_message( interaction: Message<boolean>, pattern: string, message: string ) {
  if ( is_channel( interaction ) ) {
    if ( pattern == "$" ) return register_account( interaction, message );
  }
}

async function ping( interaction: CommandInteraction<CacheType> ) {
  await interaction.reply(`🤖 pong!`);
}

function get_date() {
  const now = new Date();
  return now.toISOString().split("T")[0];
}

async function generate_snapshot( interaction: CommandInteraction<CacheType> ) {
  const embed = new MessageEmbed;
  embed.setTitle("POP Token Snapshot");
  embed.setThumbnail(POP_TOKEN_IMAGE);
  embed.addField("Date", get_date())
  embed.addField("Total", String(USERS.size))
  if ( USERS.size ) embed.addField("Users", Array.from(USERS.entries()).map(row => `\`${row[1]}\``).join(','))
  // await interaction.channel.send({embeds: [embed]});
  await interaction.reply({embeds: [embed]});
}

async function register_account( interaction: Message<boolean>, account: string ) {
  if ( !valid_account( account ) ) return;

  // reserved accounts
  if ( ["tip", "balances"].indexOf(account) != -1 ) return;

  // invalid account name
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
  USERS.set(interaction.member.id, account );
  writer.write([interaction.member.id, account, interaction.createdTimestamp, new Date().toISOString()].join(",") + "\n");
  fs.writeFileSync(filename_users, JSON.stringify(Array.from(USERS.entries()), null, 4));
}

function valid_account( account: string ) {
  return RegExp(/^[a-z1-5\.]+$/).test( account );
}