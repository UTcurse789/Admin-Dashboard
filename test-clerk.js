const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function run() {
  const res = await fetch(`https://api.clerk.dev/v1/users?limit=100&order_by=-created_at`, {
    headers: {
      Authorization: `Bearer ${CLERK_SECRET_KEY}`
    }
  });
  const data = await res.json();
  console.log(`Total users in Clerk:`, data.length);
  for (const u of data) {
    const email = u.email_addresses[0]?.email_address;
    console.log(`${u.first_name} ${u.last_name} (${email})`);
  }
}
run();
