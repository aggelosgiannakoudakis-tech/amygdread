export type BookingRequest = { room: string; date: string; time: string; people: number; name: string; email: string }
export const SLOTS = ['18:00', '19:30', '21:00', '22:30']
// TODO: connect to the real booking backend. These two functions are the only integration points.
export async function getAvailability(_room: string, _date: string): Promise<string[]> { return SLOTS }
export async function submitBooking(r: BookingRequest): Promise<{ ok: boolean }> { console.info('[amygdread:booking]', r); return { ok: true } }
