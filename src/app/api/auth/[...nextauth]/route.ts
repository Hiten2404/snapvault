import NextAuth, { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || 'dummy-google-client-id',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'dummy-google-client-secret',
    }),
    CredentialsProvider({
      name: 'Local Sandbox / Developer Mode',
      credentials: {},
      async authorize() {
        // Allow instant bypass in developer/local environment
        return {
          id: 'sandbox-user-123',
          name: 'Local Vault User',
          email: 'sandbox@snapvault.local',
          image: 'https://api.dicebear.com/7.x/bottts/svg?seed=SnapVault',
        };
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session?.user) {
        session.user.id = token.id;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || 'a-very-long-secret-key-at-least-32-chars-long-for-local-development',
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
