const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

async function setupDemoAccounts() {
  const users = [
    {
      id: 'demo_1',
      username: 'Domo',
      email: 'domo@pcfind.demo',
      password: await bcrypt.hash('Furi123', 10)
    },
    {
      id: 'demo_2',
      username: 'Zero',
      email: 'zero@pcfind.demo',
      password: await bcrypt.hash('Yoi123', 10)
    }
  ];

  const usersPath = path.join(__dirname, 'users.json');
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
  
  console.log('✅ Demo accounts created successfully!');
  console.log('Username: Domo | Password: Furi123');
  console.log('Username: Zero | Password: Yoi123');
}

setupDemoAccounts().catch(console.error);


