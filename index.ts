import { rpc, client } from "./src/config";

client.on('ready', async listener => {
  console.log(`Logged in as ${listener.user.tag}!`);
});

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
    const account = word.slice(1);
    if ( account.length > 12 ) return;
    if ( pattern != "$" ) return;
    if ( !RegExp(/^[a-z1-5\.]+$/).test( account ) ) return;
    if ( !(await is_account(account)) ) return;
    await interaction.reply(`🎉 Congrats! \`${account}\` was added to POP NFT snapshot 🥳`);
  }
});
