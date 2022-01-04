import { client } from "./src/config";

client.on('ready', async listener => {
  console.log(`Logged in as ${listener.user.tag}!`);
});

client.on('messageCreate', async interaction => {
  if ( interaction.content == "ping" ) {
    await interaction.reply('Pong!');
  }
});