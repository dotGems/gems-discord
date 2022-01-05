import fs from "fs";

const USERS = new Map<string, string>();

// load existsing
for ( const row of fs.existsSync( "users.json" ) ? require("./users.json") : [] ) {
    USERS.set(row[0], row[1]);
}

USERS.set("123", "denis.gm");
USERS.set("12345", "foo.gm");

for ( const [ member, account ] of USERS.entries()) {
    console.log( member, account );
}
fs.writeFileSync("users.json", JSON.stringify(Array.from(USERS.entries()), null, 4));


// fs.writeFileSync