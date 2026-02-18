# IoTHub Controller

A modern IoT device management system built with Next.js 16, featuring user authentication, role-based access control, and a dark mode toggle.

## Features

- **Next.js 16** with App Router
- **Authentication System**: Sign up and login functionality
- **User Management**: Admin panel for managing users
- **Dark Mode**: Toggle between light and dark themes
- **MongoDB with Prisma**: Database integration for user data
- **Shadcn UI + Tailwind CSS**: Modern, accessible UI components

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Shadcn UI components
- Prisma ORM
- MongoDB
- bcryptjs for password hashing
- next-themes for dark mode

## Prerequisites

- Node.js 18+ 
- MongoDB instance (local or cloud)
- npm or yarn

## Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/bedro96/iothub-controller.git
   cd iothub-controller
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   DATABASE_URL="mongodb://localhost:27017/iothub-controller"
   # Or use MongoDB Atlas:
   # DATABASE_URL="mongodb+srv://username:password@cluster.mongodb.net/iothub-controller"
   
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="your-secret-key-change-this-in-production"
   ```

4. **Generate Prisma Client**
   ```bash
   npx prisma generate
   ```

5. **Push database schema** (for MongoDB)
   ```bash
   npx prisma db push
   ```

6. **Run the development server**
   ```bash
   npm run dev
   ```

7. **Open your browser**
   
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/
│   │   │   └── signup/
│   │   └── users/
│   ├── admin/          # Admin user management page
│   ├── login/          # Login page
│   ├── signup/         # Sign up page
│   ├── layout.tsx      # Root layout with theme provider
│   └── page.tsx        # Home page
├── components/
│   ├── ui/             # Shadcn UI components
│   ├── mode-toggle.tsx # Dark mode toggle
│   └── theme-provider.tsx
├── lib/
│   ├── prisma.ts       # Prisma client instance
│   └── utils.ts        # Utility functions
└── prisma/
    └── schema.prisma   # Database schema
```

## Usage

### Sign Up
1. Navigate to `/signup`
2. Enter username, email, and password
3. Submit to create a new account

### Login
1. Navigate to `/login`
2. Enter your email and password
3. You'll be redirected based on your role (admin → `/admin`, user → `/`)

### Admin Panel
1. Login with an admin account
2. Navigate to `/admin`
3. View all users, change roles, or delete users

### Dark Mode
- Click the moon/sun icon in the top right to toggle between light and dark themes
- The theme preference is saved automatically

## Database Schema

### User Model
```prisma
model User {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  username  String   @unique
  email     String   @unique
  password  String
  role      String   @default("user")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

## Creating an Admin User

To create an admin user, you can:

1. Sign up normally and update the user role in MongoDB:
   ```javascript
   db.User.updateOne(
     { email: "admin@example.com" },
     { $set: { role: "admin" } }
   )
   ```

2. Or modify the signup API to accept a role parameter (not recommended for production)

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Security Notes

- Passwords are hashed using bcryptjs before storing in the database
- In production, ensure you:
  - Use a strong `NEXTAUTH_SECRET`
  - Use HTTPS for all connections
  - Implement proper session management (consider using NextAuth.js)
  - Add rate limiting to prevent brute force attacks
  - Validate and sanitize all user inputs

## License

MIT
