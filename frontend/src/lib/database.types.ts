export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type ExpenseType = 'fuel' | 'charge'
export type TripPurpose = 'dienstlich' | 'privat' | 'arbeitsweg'
export type BodyType    = 'kleinwagen' | 'limousine' | 'kombi' | 'suv' | 'transporter'
export type FuelType    = 'benzin' | 'diesel' | 'elektro' | 'hybrid' | 'plugin_hybrid' | 'gas' | 'wasserstoff'
export type TireSeason  = 'sommer' | 'winter' | 'ganzjahr'
export type ServiceType = 'oelwechsel' | 'inspektion' | 'reifenwechsel' | 'hu' | 'reparatur' | 'sonstiges'
/** Kartei-Abschnitte, die ein freigegebener Fahrer bearbeiten darf */
export type VehicleSection = 'reifen' | 'wartung' | 'notizen'

export interface Database {
  public: {
    Tables: {
      vehicles: {
        Row: {
          id: string
          user_id: string
          model: string
          license_plate: string
          current_mileage: number
          created_at: string
          updated_at: string
          body_type: BodyType
          color: string
          vin: string | null
          first_registration: string | null
          fuel_type: FuelType | null
          power_ps: number | null
          displacement_ccm: number | null
          top_speed_kmh: number | null
          empty_weight_kg: number | null
          consumption: number | null
          hu_due: string | null
          insurance: string | null
          insurance_number: string | null
          oil_type: string | null
          service_interval_km: number | null
          next_service_km: number | null
          next_service_date: string | null
        }
        Insert: {
          id?: string
          user_id: string
          model: string
          license_plate: string
          current_mileage: number
          created_at?: string
          updated_at?: string
          body_type?: BodyType
          color?: string
          vin?: string | null
          first_registration?: string | null
          fuel_type?: FuelType | null
          power_ps?: number | null
          displacement_ccm?: number | null
          top_speed_kmh?: number | null
          empty_weight_kg?: number | null
          consumption?: number | null
          hu_due?: string | null
          insurance?: string | null
          insurance_number?: string | null
          oil_type?: string | null
          service_interval_km?: number | null
          next_service_km?: number | null
          next_service_date?: string | null
        }
        Update: Partial<Database['public']['Tables']['vehicles']['Insert']>
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
          purpose: TripPurpose
          business_partner: string | null
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
          purpose: TripPurpose
          business_partner?: string | null
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
          purpose?: TripPurpose
          business_partner?: string | null
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
      expenses: {
        Row: {
          id: string
          vehicle_id: string | null
          driver_id: string
          amount: number
          type: ExpenseType
          dropbox_link: string | null
          date: string
          created_at: string
        }
        Insert: {
          id?: string
          vehicle_id?: string | null
          driver_id: string
          amount: number
          type: ExpenseType
          dropbox_link?: string | null
          date: string
          created_at?: string
        }
        Update: {
          id?: string
          vehicle_id?: string | null
          driver_id?: string
          amount?: number
          type?: ExpenseType
          dropbox_link?: string | null
          date?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          }
        ]
      }
      vehicle_members: {
        Row: {
          vehicle_id: string
          user_id: string
          email: string
          editable_sections: VehicleSection[]
          created_at: string
        }
        Insert: {
          vehicle_id: string
          user_id: string
          email: string
          editable_sections?: VehicleSection[]
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['vehicle_members']['Insert']>
        Relationships: []
      }
      vehicle_tires: {
        Row: {
          id: string
          vehicle_id: string
          season: TireSeason
          brand: string | null
          model: string | null
          size: string | null
          load_speed_index: string | null
          dot: string | null
          rim: string | null
          tread_depth_mm: number | null
          pressure_front_bar: number | null
          pressure_rear_bar: number | null
          pressure_front_loaded_bar: number | null
          pressure_rear_loaded_bar: number | null
          storage_location: string | null
          is_mounted: boolean
          notes: string | null
          created_at: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          vehicle_id: string
          season?: TireSeason
          brand?: string | null
          model?: string | null
          size?: string | null
          load_speed_index?: string | null
          dot?: string | null
          rim?: string | null
          tread_depth_mm?: number | null
          pressure_front_bar?: number | null
          pressure_rear_bar?: number | null
          pressure_front_loaded_bar?: number | null
          pressure_rear_loaded_bar?: number | null
          storage_location?: string | null
          is_mounted?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: Partial<Database['public']['Tables']['vehicle_tires']['Insert']>
        Relationships: []
      }
      vehicle_service_log: {
        Row: {
          id: string
          vehicle_id: string
          type: ServiceType
          date: string
          mileage: number | null
          cost: number | null
          workshop: string | null
          description: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          vehicle_id: string
          type: ServiceType
          date?: string
          mileage?: number | null
          cost?: number | null
          workshop?: string | null
          description?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['vehicle_service_log']['Insert']>
        Relationships: []
      }
      vehicle_notes: {
        Row: {
          id: string
          vehicle_id: string
          body: string
          author_email: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          vehicle_id: string
          body: string
          author_email?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['vehicle_notes']['Insert']>
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_vehicle_member: {
        Args: { p_vehicle_id: string; p_email: string; p_sections?: VehicleSection[] }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
