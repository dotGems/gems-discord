import { rpc, client, redis_client } from "./src/config";
import fs from "fs";
import { Message, MessageEmbed, CommandInteraction, CacheType, TextChannel, Guild, MessageFlags, MessageSelectMenu, ReactionCollector, MessageReaction, ReactionManager, Emoji, Collection } from "discord.js"
import { SlashCommandBuilder } from '@discordjs/builders';
import { on } from "events";
import { Stream } from "stream";
import { CpuInfo } from "os";

redis_client.on('error', err => {
  console.log('Error' + err);
});

client.on('ready', async listener => {
  console.log(`Logged in as ${listener.user.tag}!`);

  await redis_client.connect()

  //Find messages in server that were missed if bot was offline

  //Retrieve all text channel ids
  const retrieve = client.channels.cache.filter(guild_type =>(guild_type.type === "GUILD_TEXT")).map(chan_id =>Object.values(({id: chan_id.id})))

  //Limit for how many server messages will be scanned. Note that the quantity of messages pulled from redis will be 1.5x bigger than the messLimit.
  const messLimit = 100
  const value = redis_client.sendCommand([
    "XREVRANGE",
    "messages",
    "+",
    "-",
    "COUNT", String(messLimit * 1.5),
  ]);

  value.then(function(last_message) {
    while (retrieve.length != 0) {
      //select from text channel list
      const channel = client.channels.cache.get(retrieve[0][0])
      if (channel.isText()) {
      channel.messages.fetch({limit: messLimit}).then(messages => {
        
        //pull messages from discord channels
        var mapped = messages.map(mess =>({ 
          channelId: mess.channelId, 
          messageId: mess.id, 
          content: mess.content 
        }));

        //pull messaged from redis
        var discMapped = (last_message as unknown as any[]).map(nested => nested.map(disc =>({
          channelId: disc[5], 
          messageId: disc[7], 
          content: disc[9] 
        })).pop());
        
        //find differences
        let rev_difference = mapped.filter(object1 => 
          !discMapped.some(object2 => object1.messageId === object2.messageId)
        );

        var difference = rev_difference.reverse()
        console.log("Missed Messages:")
        console.table(difference)

        //insert messages into redis
        while (difference.length != 0) {
          channel.messages.fetch(difference[0].messageId).then(new_mes => {
            if (new_mes.type === 'DEFAULT') {
              //console.log(new_mes.author.id, new_mes.channelId, new_mes.id, new_mes.content, new Date(new_mes.createdTimestamp).toISOString())
              
              redis_client.sendCommand([
                
                "XADD" ,
                "messages" , 
                "*" , 
                "serverId", new_mes.guild.id,
                "memberId", new_mes.author.id , 
                "channelId", new_mes.channelId , 
                "messageId", new_mes.id, 
                "message" , new_mes.content , 
                "date" , new Date(new_mes.createdTimestamp).toISOString()
              ])
            }
          })
          difference.shift();
        }
      })
      retrieve.shift();
    }
  }
  });

  //Find reactions in server that were missed if bot was offline

  //Retrieve all text channel ids
  const retrieveTwo = client.channels.cache.filter(guild_type =>(guild_type.type === "GUILD_TEXT")).map(chan_id =>Object.values(({id: chan_id.id})))

  //Limit for how many server messages will be scanned. Note that the quantity of messages pulled from redis will be 1.5x bigger than the rateLimit.
  const reactLimit = 100
  const react_value = redis_client.sendCommand([
    "XREVRANGE",
    "reactions", 
    "+", 
    "-",
    "COUNT", String(reactLimit * 1.5),
  ]);
  
  react_value.then(async function(last_reaction) {
    while (retrieveTwo.length != 0) {

      //select from text channel list
      const channel = client.channels.cache.get(retrieveTwo[0][0])
      if (channel.isText()) {
        
      
      channel.messages.fetch({limit: messLimit}).then(async messages => {
        
        //pull reactions from discord channels
        var messageId = (messages.map(mess =>{return mess.id}));

        var i = 0
        var reactMapped = []
        while (messageId.length != i) {
          const react = await channel.messages.fetch(messageId[i])
          
          const mapped = react.reactions.cache.map(reaction => ({
            channelId: reaction.message.channel.id, 
            memberId: reaction.message.author.id,
            messageId: reaction.message.id,
            emoji: reaction.emoji.name
          }));

          var len = mapped.length

          if (len !== 0) {
            mapped.map(thing => (
              reactMapped.push(thing)
            ))
          }

          if (i === reactLimit -1) {
            break;
          }

          var i = i + 1
        }

        //pull reactions from redis
        var discMapped = (last_reaction as unknown as any[]).map(nested => nested.map(disc =>({
          channelId: disc[5], 
          memberId: disc[3],
          messageId: disc[7],
          emoji: disc[9], 
        })).pop());

        //find differences
        let rev_difference = reactMapped.filter(object1 =>
          !discMapped.some(object2 =>
            object1.memberId === object2.memberId &&
            object1.emoji === object2.emoji &&
            object1.channelId === object2.channelId &&
            object1.messageId === object2.messageId
          )
        );

        var difference = rev_difference.reverse()
        console.log("Missed Reactions:")
        console.table(difference)
        //insert messages into redis
        while (difference.length != 0) {
          var  diff = difference[0]
          const react = await channel.messages.fetch(diff.messageId)
          var timestamp = react.reactions.cache.get(diff.emoji)?.message?.createdTimestamp
          //console.log(diff.channelId, diff.memberId, diff.messageId, diff.emoji, react.reactions.cache.get(diff.emoji).message.content, react.reactions.cache.get(diff.emoji).count, new Date(timestamp).toISOString())
          if ( timestamp ) {
            redis_client.sendCommand([
              "XADD" ,
              "reactions" ,
              "*" ,
              "serverId", String(react.reactions.cache.get(diff.emoji)?.message?.guild?.id),
              "memberId", diff.memberId ,
              "channelId", diff.channelId ,
              "messageId", diff.messageId,
              "emoji", diff.emoji ,
              "messageReactedTo" , String(react.reactions.cache.get(diff.emoji)?.message?.content) ,
              "totalReactions" , String(react.reactions.cache.get(diff.emoji)?.count) ,
              "date" , new Date(timestamp).toISOString()
            ])
          }
          difference.shift();
        }
      })
      retrieveTwo.shift();
    }
  }
  });

  // commands
  await client.application.commands.create({name: "ping", description: "responds with ping", type: "CHAT_INPUT"})
  await client.application.commands.create({name: "snapshot", description: "Generates POP Token snapshot", type: "CHAT_INPUT"})
  //await client.application.commands.create({name: "profile", description: "Lets users view their profile", type: "CHAT_INPUT"})
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
    "serverId" , newState.guild.id,
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
  redis_client.sendCommand([
    "XADD" ,
    "messages" , 
    "*" , 
    "serverId" , interaction.guild.id,
    "memberId" , interaction.member.id , 
    "channelId" , interaction.channelId , 
    "messageId" , interaction.id, 
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
    "serverId",  reaction.message.guild.id,
    "memberId" , reaction.message.author['id'] , 
    "channelId" , reaction.message.channelId , 
    "messageId" , reaction.message.id,
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
	} /*else if (commandName === 'profile') {
    await generate_profile(interaction);
  }*/
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
/*
async function generate_profile( interaction: CommandInteraction<CacheType> ) {
  const embed = new MessageEmbed
  embed.setTitle("Profile");
}
*/

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
      "serverId" , interaction.guild.id, 
      "memberId" , interaction.member.id , 
      "channelId" , interaction.channelId , 
      "account" , account , 
      "timestamp" , String(interaction.createdTimestamp) , 
      "date" , new Date().toISOString()
    ]);

    //add new users

    redis_client.hSet(
      'users',
      interaction.member.id,
      account
    );
  }
  //fs.writeFileSync(filename_users, JSON.stringify(Array.from(USERS.entries()), null, 4));
}

function valid_account( account: string ) {
  return RegExp(/^[a-z1-5\.]+$/).test( account );
}