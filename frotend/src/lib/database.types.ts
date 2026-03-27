export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      vehicles: {
        Row: {
          id: string
          model: string
          license_plate: string
          current_mileage: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          model: string
          license_plate: string
          current_mileage: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          model?: string
          license_plate?: string
          current_mileage?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      trips: {
        Row: {
          id: string
          vehicle_id: string
          user_id: string
          driver_id: string
          start_km: number
          end_km: number | null
          start_location: string
          end_location: string | null
          timestamp: string
          created_at: string
        }
        Insert: {
          id?: string
          vehicle_id: string
          user_id: string
          driver_id: string
          start_km: number
          end_km?: number | null
          start_location: string
          end_location?: string | null
          timestamp: string
          created_at?: string
        }
        Update: {
          id?: string
          vehicle_id?: string
          user_id?: string
          driver_id?: string | null
          start_km?: number
          end_km?: number | null
          start_location?: string
          end_location?: string | null
          timestamp?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
