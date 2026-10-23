export type OrderStatus = 'placed' | 'approved' | 'delivered';

// An order of the PetStore store, as POST /store/order and GET /store/order/{id} send and
// return it. shipDate is a date-time text: sent as "2026-10-23T10:00:00.000Z", the PetStore
// returns it as "2026-10-23T10:00:00.000+0000" (the same moment, UTC written another way).
export interface Order {
  id: number;
  petId: number;
  quantity: number;
  shipDate: string;
  status?: OrderStatus;
  complete?: boolean;
}
