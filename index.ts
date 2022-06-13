import { rpc, client, redis_client } from "./src/config";
import fs from "fs";
import { Message, MessageEmbed, CommandInteraction, CacheType } from "discord.js"
import { SlashCommandBuilder } from '@discordjs/builders';
import { on } from "events";
import { Stream } from "stream";

redis_client.on('error', err => {
  console.log('Error' + err);
});


client.on('ready', async listener => {
  
  console.log(`Logged in as ${listener.user.tag}!`);

  await redis_client.connect()

  // commands
  await client.application.commands.create({name: "ping", description: "responds with ping", type: "CHAT_INPUT"})
  await client.application.commands.create({name: "snapshot", description: "Generates POP Token snapshot", type: "CHAT_INPUT"})
});
/*
// CONFIGURATIONS
const CHANNEL_IDS = [
  "980934610051551282", // #bot-testing
  "980934610051551282"  // #stream-chat
]

const ADMIN_CHANNEL_IDS = [
  "980934610051551282", // #bot-testing
  "980934610051551282"  // #stream-chat
]
*/
const POP_TOKEN_IMAGE = "https://ipfs.io/ipfs/QmZnZ4eCSWPNU2XkXT4Yn3LsCYXYgCPqgLVpqGBTEBzo91";

function is_admin_channel(interaction: Message<boolean>)
{
  //return ADMIN_CHANNEL_IDS.indexOf(interaction.channelId) != -1;
}

function is_channel(interaction: Message<boolean>)
{
  //return CHANNEL_IDS.indexOf(interaction.channelId) != -1;
}

const USERS = new Map<string, string>();
const MESSAGES = new Map<string, string>();

const filename_discord = `./snapshots/${ get_date() }-discord.csv`;
const filename_users = `./snapshots/${ get_date() }-users.json`;


//Detect if event has started, been edited, or ended
//Not functional
/*
client.on('guildScheduledEventCreate', (guildScheduledEvent) =>{
  console.log(guildScheduledEvent.channelId);
  console.log(guildScheduledEvent.createdAt);
  console.log(guildScheduledEvent.scheduledEndAt);
  console.log(guildScheduledEvent.description);
  console.log(guildScheduledEvent.status);


  console.log("Event created")
}); 

client.on('guildScheduledEventUpdate', (guildScheduledEvent) =>{
  const dateString = new Date().toISOString();
  var description = guildScheduledEvent.description;
  var name = guildScheduledEvent.name;
  var channel = guildScheduledEvent.channel;
  console.log(guildScheduledEvent.channelId);
  console.log(guildScheduledEvent.createdAt);
  console.log(guildScheduledEvent.scheduledEndAt);
  console.log(guildScheduledEvent.description);
  console.log(guildScheduledEvent.status);

  console.log("Event edited/started")

  if (guildScheduledEvent.status == "ACTIVE" && description == guildScheduledEvent.description && name == guildScheduledEvent.name && channel == guildScheduledEvent.name){
    console.log("Event has ended" + dateString + " with status " + guildScheduledEvent.status)
    console.log(description)
    console.log(name)
    console.log(channel)
  } else if (guildScheduledEvent.status == "ACTIVE"){
    console.log("Event has been modified at" + dateString + " with status " + guildScheduledEvent.status)
    console.log(description)
    console.log(name)
    console.log(channel)
    var description = guildScheduledEvent.description;
    var name = guildScheduledEvent.name;
    var channel = guildScheduledEvent.channel;

  } else if (guildScheduledEvent.status == "SCHEDULED"){
    var description = guildScheduledEvent.description;
    var name = guildScheduledEvent.name;
    var channel = guildScheduledEvent.channel;
    console.log(description)
    console.log(name)
    console.log(channel)
  }
}); 
*/

//monitor voice channels

client.on('voiceStateUpdate', async (oldState, newState) => {
  //check if deafened or muted
  const dateString = new Date().toISOString();
  var mute = "err";
  var deaf = "err";
  //check when user joined or left a call
  if (oldState.channelId == null && newState.channelId != null) {
    var userState = "joined";
    var voiceChannel = newState.channelId;
    
  } else if (newState.channelId == null && oldState.channelId != null){
      var userState = "left";
      var voiceChannel = oldState.channelId;

  } else if (newState.id && oldState == null){
      console.log("Error, both id values are Null");
  } else {
      var userState = "on call";
      var voiceChannel = newState.channelId;
  }

  if (newState.selfMute == true) {
    var mute = "muted";
  } else if (newState.selfMute == false) {
    var mute = "unmuted";
  }

  if (newState.selfMute == true) {
    var deaf = "deafened";
  } else if (newState.selfMute == false) {
    var deaf = "not deafened";
  }

  //insert voice channel data into redis stream

  redis_client.sendCommand([
    "XADD" , 
    "voiceChannel" , 
    "*" , 
    "memberId" , newState.id , 
    "channelId" , voiceChannel , 
    "callStatus" , userState , 
    "muted" , mute , 
    "deafened" , deaf , 
    "date" , new Date().toISOString()
  ]);
});



//monitor messages

client.on('messageCreate', async interaction => {
  const message = interaction.content;
  await text_monitor(interaction, message);
});

client.on('messageUpdate', async (previous, current: any)  => {
  const message = current.content;
  await text_monitor(current, message);
});

//insert messages into redis stream

function text_monitor ( interaction: Message<boolean>, message: string ) {
  redis_client.sendCommand(["XADD" ,
    "messages" , 
    "*" , 
    "memberId", interaction.member.id , 
    "channelId", interaction.channelId , 
    "message" , message , 
    "date" , new Date().toISOString()
  ]);
}

//check for message reactions

client.on('messageReactionAdd', async (reaction, user) => {
  if (reaction.partial) {
		try {
			await reaction.fetch();
		} catch (error) {
			console.error('Something went wrong when fetching the message:', error);
			return;
		}
	}

//insert reactions into redis stream
  redis_client.sendCommand([
    "XADD" , 
    "reactions" , 
    "*" , 
    "memberId" , reaction.message.author['id'] , 
    "channelId" , reaction.message.channelId , 
    "emoji" , reaction.emoji.toString() , 
    "messageReactedTo" , reaction.message.content , 
    "totalReactions" , String(reaction.count) , 
    "date" , new Date().toISOString()
  ]);
});


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
  //if ( is_channel( interaction ) ) {
    if ( pattern == "$" ) return register_account( interaction, message );
  //}
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
    USERS.set(interaction.member.id, account );

    //log of users who claimed tokens

    redis_client.sendCommand([
      "XADD" , 
      "activeUsers" , 
      "*" , 
      "memberId" , interaction.member.id , 
      "channelId" , interaction.channelId , 
      "account" , account , 
      "timestamp" , String(interaction.createdTimestamp) , 
      "date" , new Date().toISOString()
    ]);

    //add new users

    redis_client.sendCommand([
      "HSET",
      "users",
      interaction.member.id,
      account
    ])
  }
  //fs.writeFileSync(filename_users, JSON.stringify(Array.from(USERS.entries()), null, 4));
}

function valid_account( account: string ) {
  return RegExp(/^[a-z1-5\.]+$/).test( account );
}