// Who is signed in, as the Worker sees it. Access gates the PAGE at the edge
// (roadmap/inprogress/studio-shell.md → Auth), so by the time this runs an
// anonymous visitor has already been sent to the OTP prompt; what is left to
// learn is the address, and whether D1 still lists it as active.
import { LibraryClient, LibraryRequestError } from '../../../src/storage/libraryClient.ts';

export type Session =
  | { kind: 'signed-in'; email: string }
  /** Access admitted the address but D1 has it inactive or unknown (403). */
  | { kind: 'not-permitted' }
  /** No identity reached the Worker (401). Behind the gate that means the
   *  Access session lapsed mid-visit; in local dev, that there is no gate. */
  | { kind: 'signed-out' }
  | { kind: 'unavailable'; message: string };

export async function loadSession(client: LibraryClient): Promise<Session> {
  try {
    const { user } = await client.me();
    return { kind: 'signed-in', email: user.email };
  } catch (error) {
    if (error instanceof LibraryRequestError) {
      if (error.status === 403) return { kind: 'not-permitted' };
      if (error.status === 401) return { kind: 'signed-out' };
      return { kind: 'unavailable', message: error.message };
    }
    return { kind: 'unavailable', message: 'The library is unavailable.' };
  }
}

/** Re-entering the page is the sign-in: Access answers `/studio/` itself. */
export function signIn(): void {
  location.assign('/studio/');
}
