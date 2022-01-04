import { client } from "./src/config";

client.on('ready', async listener => {
  console.log(`Logged in as ${listener.user.tag}!`);
});

client.on('messageCreate', async interaction => {
  const pattern = interaction.content.match(/\$([a-z0-5\.]{1,12})/);

  if ( pattern?.length ) {
    const account = pattern[1];
    await interaction.reply(`🎉 Congrats! \`${account}\` was added to POP NFT snapshot 🥳`);
  }
});