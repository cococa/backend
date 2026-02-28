import { ensureDemoUser } from '../src/services/user.service.js'

async function main() {
  const email = process.env.AUTH_DEMO_EMAIL || 'demo@chartly.dev'
  const name = process.env.AUTH_DEMO_NAME || 'Chartly Demo'

  const user = await ensureDemoUser({
    email,
    name
  })

  console.log(
    JSON.stringify(
      {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        }
      },
      null,
      2
    )
  )
}

main()
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
