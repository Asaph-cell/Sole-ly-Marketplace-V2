export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      account_bans: {
        Row: {
          ban_type: string
          banned_at: string
          banned_by: string | null
          id: string
          lifted_at: string | null
          notes: string | null
          reason: string
          user_id: string
        }
        Insert: {
          ban_type: string
          banned_at?: string
          banned_by?: string | null
          id?: string
          lifted_at?: string | null
          notes?: string | null
          reason: string
          user_id: string
        }
        Update: {
          ban_type?: string
          banned_at?: string
          banned_by?: string | null
          id?: string
          lifted_at?: string | null
          notes?: string | null
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_activity_log: {
        Row: {
          action_type: string
          admin_id: string
          created_at: string
          details: Json
          id: string
          target_id: string | null
          target_type: string
          vendor_id: string | null
        }
        Insert: {
          action_type: string
          admin_id: string
          created_at?: string
          details?: Json
          id?: string
          target_id?: string | null
          target_type: string
          vendor_id?: string | null
        }
        Update: {
          action_type?: string
          admin_id?: string
          created_at?: string
          details?: Json
          id?: string
          target_id?: string | null
          target_type?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_activity_log_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_activity_log_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_activity_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_activity_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_suggestions: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          status: string | null
          topic: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          status?: string | null
          topic: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          status?: string | null
          topic?: string
          user_id?: string | null
        }
        Relationships: []
      }
      commission_ledger: {
        Row: {
          commission_amount: number
          commission_rate: number
          id: string
          notes: string | null
          order_id: string
          recorded_at: string
          vendor_id: string
        }
        Insert: {
          commission_amount: number
          commission_rate: number
          id?: string
          notes?: string | null
          order_id: string
          recorded_at?: string
          vendor_id: string
        }
        Update: {
          commission_amount?: number
          commission_rate?: number
          id?: string
          notes?: string | null
          order_id?: string
          recorded_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_ledger_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_ledger_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_ledger_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_feedback: {
        Row: {
          admin_notes: string | null
          created_at: string
          id: string
          message: string
          status: string | null
          user_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          message: string
          status?: string | null
          user_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          message?: string
          status?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          buyer_id: string | null
          created_at: string | null
          delivery_agreement_id: string | null
          id: string
          product_ids: string[] | null
          updated_at: string | null
          vendor_id: string
        }
        Insert: {
          buyer_id?: string | null
          created_at?: string | null
          delivery_agreement_id?: string | null
          id?: string
          product_ids?: string[] | null
          updated_at?: string | null
          vendor_id: string
        }
        Update: {
          buyer_id?: string | null
          created_at?: string | null
          delivery_agreement_id?: string | null
          id?: string
          product_ids?: string[] | null
          updated_at?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_delivery_agreement_id_fkey"
            columns: ["delivery_agreement_id"]
            isOneToOne: false
            referencedRelation: "delivery_agreements"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_agreements: {
        Row: {
          agreed_at: string | null
          buyer_address: string | null
          buyer_city: string | null
          buyer_county: string | null
          buyer_delivery_notes: string | null
          buyer_email: string | null
          buyer_gps_lat: number | null
          buyer_gps_lng: number | null
          buyer_id: string
          buyer_name: string | null
          buyer_phone: string | null
          conversation_id: string | null
          created_at: string
          delivery_fee_ksh: number
          delivery_method: string | null
          expires_at: string
          id: string
          product_ids: string[]
          proposed_by: string | null
          status: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          agreed_at?: string | null
          buyer_address?: string | null
          buyer_city?: string | null
          buyer_county?: string | null
          buyer_delivery_notes?: string | null
          buyer_email?: string | null
          buyer_gps_lat?: number | null
          buyer_gps_lng?: number | null
          buyer_id: string
          buyer_name?: string | null
          buyer_phone?: string | null
          conversation_id?: string | null
          created_at?: string
          delivery_fee_ksh?: number
          delivery_method?: string | null
          expires_at?: string
          id?: string
          product_ids: string[]
          proposed_by?: string | null
          status?: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          agreed_at?: string | null
          buyer_address?: string | null
          buyer_city?: string | null
          buyer_county?: string | null
          buyer_delivery_notes?: string | null
          buyer_email?: string | null
          buyer_gps_lat?: number | null
          buyer_gps_lng?: number | null
          buyer_id?: string
          buyer_name?: string | null
          buyer_phone?: string | null
          conversation_id?: string | null
          created_at?: string
          delivery_fee_ksh?: number
          delivery_method?: string | null
          expires_at?: string
          id?: string
          product_ids?: string[]
          proposed_by?: string | null
          status?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_agreements_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_agreements_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_agreements_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dispute_messages: {
        Row: {
          created_at: string | null
          dispute_id: string
          id: string
          message: string
          sender_id: string
          sender_role: string
        }
        Insert: {
          created_at?: string | null
          dispute_id: string
          id?: string
          message: string
          sender_id: string
          sender_role: string
        }
        Update: {
          created_at?: string | null
          dispute_id?: string
          id?: string
          message?: string
          sender_id?: string
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispute_messages_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "disputes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispute_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispute_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          admin_notes: string | null
          admin_resolution: string | null
          admin_resolved_at: string | null
          buyer_evidence_urls: string[] | null
          customer_id: string
          description: string | null
          dispute_type: string | null
          id: string
          opened_at: string
          order_id: string
          reason: Database["public"]["Enums"]["dispute_reason"]
          refund_amount: number | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["dispute_status"]
          vendor_evidence_urls: string[] | null
          vendor_id: string
          vendor_response: string | null
          vendor_response_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          admin_resolution?: string | null
          admin_resolved_at?: string | null
          buyer_evidence_urls?: string[] | null
          customer_id: string
          description?: string | null
          dispute_type?: string | null
          id?: string
          opened_at?: string
          order_id: string
          reason: Database["public"]["Enums"]["dispute_reason"]
          refund_amount?: number | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          vendor_evidence_urls?: string[] | null
          vendor_id: string
          vendor_response?: string | null
          vendor_response_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          admin_resolution?: string | null
          admin_resolved_at?: string | null
          buyer_evidence_urls?: string[] | null
          customer_id?: string
          description?: string | null
          dispute_type?: string | null
          id?: string
          opened_at?: string
          order_id?: string
          reason?: Database["public"]["Enums"]["dispute_reason"]
          refund_amount?: number | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          vendor_evidence_urls?: string[] | null
          vendor_id?: string
          vendor_response?: string | null
          vendor_response_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "disputes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      escrow_transactions: {
        Row: {
          commission_amount: number
          created_at: string
          held_amount: number
          id: string
          notes: string | null
          order_id: string
          payment_id: string
          refunded_at: string | null
          release_amount: number
          released_at: string | null
          status: Database["public"]["Enums"]["escrow_status"]
        }
        Insert: {
          commission_amount: number
          created_at?: string
          held_amount: number
          id?: string
          notes?: string | null
          order_id: string
          payment_id: string
          refunded_at?: string | null
          release_amount: number
          released_at?: string | null
          status?: Database["public"]["Enums"]["escrow_status"]
        }
        Update: {
          commission_amount?: number
          created_at?: string
          held_amount?: number
          id?: string
          notes?: string | null
          order_id?: string
          payment_id?: string
          refunded_at?: string | null
          release_amount?: number
          released_at?: string | null
          status?: Database["public"]["Enums"]["escrow_status"]
        }
        Relationships: [
          {
            foreignKeyName: "escrow_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escrow_transactions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          conversation_id: string
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          message_type: string
          metadata: Json | null
          sender_id: string
          sender_role: string
        }
        Insert: {
          conversation_id: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          message_type?: string
          metadata?: Json | null
          sender_id: string
          sender_role?: string
        }
        Update: {
          conversation_id?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          message_type?: string
          metadata?: Json | null
          sender_id?: string
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      mpesa_transactions: {
        Row: {
          amount: number
          checkout_request_id: string
          created_at: string
          id: string
          merchant_request_id: string
          mpesa_receipt_number: string | null
          phone_number: string
          plan: string
          result_code: number | null
          result_desc: string | null
          status: string
          transaction_date: string | null
          updated_at: string
          vendor_id: string
        }
        Insert: {
          amount: number
          checkout_request_id: string
          created_at?: string
          id?: string
          merchant_request_id: string
          mpesa_receipt_number?: string | null
          phone_number: string
          plan: string
          result_code?: number | null
          result_desc?: string | null
          status?: string
          transaction_date?: string | null
          updated_at?: string
          vendor_id: string
        }
        Update: {
          amount?: number
          checkout_request_id?: string
          created_at?: string
          id?: string
          merchant_request_id?: string
          mpesa_receipt_number?: string | null
          phone_number?: string
          plan?: string
          result_code?: number | null
          result_desc?: string | null
          status?: string
          transaction_date?: string | null
          updated_at?: string
          vendor_id?: string
        }
        Relationships: []
      }
      notification_logs: {
        Row: {
          channel: string
          created_at: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          order_id: string | null
          recipient: string | null
          retry_count: number | null
          status: string
          type: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          channel: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          order_id?: string | null
          recipient?: string | null
          retry_count?: number | null
          status: string
          type: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          order_id?: string | null
          recipient?: string | null
          retry_count?: number | null
          status?: string
          type?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          related_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          related_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          related_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          color: string | null
          id: string
          line_total_ksh: number
          order_id: string
          product_id: string | null
          product_name: string
          product_snapshot: Json
          quantity: number
          unit_price_ksh: number
        }
        Insert: {
          color?: string | null
          id?: string
          line_total_ksh: number
          order_id: string
          product_id?: string | null
          product_name: string
          product_snapshot: Json
          quantity: number
          unit_price_ksh: number
        }
        Update: {
          color?: string | null
          id?: string
          line_total_ksh?: number
          order_id?: string
          product_id?: string | null
          product_name?: string
          product_snapshot?: Json
          quantity?: number
          unit_price_ksh?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_shipping_details: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          country: string
          county: string | null
          courier_name: string | null
          created_at: string
          delivery_current_latitude: number | null
          delivery_current_longitude: number | null
          delivery_location_updated_at: string | null
          delivery_notes: string | null
          delivery_tracking_enabled: boolean | null
          delivery_type: string | null
          email: string | null
          gps_latitude: number | null
          gps_longitude: number | null
          order_id: string
          phone: string
          postal_code: string | null
          recipient_name: string
          shipment_proof_url: string | null
          tracking_number: string | null
          tracking_started_at: string | null
          tracking_stopped_at: string | null
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string
          county?: string | null
          courier_name?: string | null
          created_at?: string
          delivery_current_latitude?: number | null
          delivery_current_longitude?: number | null
          delivery_location_updated_at?: string | null
          delivery_notes?: string | null
          delivery_tracking_enabled?: boolean | null
          delivery_type?: string | null
          email?: string | null
          gps_latitude?: number | null
          gps_longitude?: number | null
          order_id: string
          phone: string
          postal_code?: string | null
          recipient_name: string
          shipment_proof_url?: string | null
          tracking_number?: string | null
          tracking_started_at?: string | null
          tracking_stopped_at?: string | null
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string
          county?: string | null
          courier_name?: string | null
          created_at?: string
          delivery_current_latitude?: number | null
          delivery_current_longitude?: number | null
          delivery_location_updated_at?: string | null
          delivery_notes?: string | null
          delivery_tracking_enabled?: boolean | null
          delivery_type?: string | null
          email?: string | null
          gps_latitude?: number | null
          gps_longitude?: number | null
          order_id?: string
          phone?: string
          postal_code?: string | null
          recipient_name?: string
          shipment_proof_url?: string | null
          tracking_number?: string | null
          tracking_started_at?: string | null
          tracking_stopped_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_shipping_details_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_tracking_events: {
        Row: {
          created_at: string
          id: string
          location: string | null
          note: string | null
          order_id: string
          proof_image_url: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          location?: string | null
          note?: string | null
          order_id: string
          proof_image_url?: string | null
          status: string
        }
        Update: {
          created_at?: string
          id?: string
          location?: string | null
          note?: string | null
          order_id?: string
          proof_image_url?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_tracking_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          accepted_at: string | null
          auto_release_at: string | null
          buyer_confirmed: boolean
          cancelled_at: string | null
          commission_amount: number
          commission_rate: number
          completed_at: string | null
          confirmed_at: string | null
          created_at: string
          customer_id: string | null
          delivered_at: string | null
          delivery_otp: string | null
          dispute_id: string | null
          id: string
          otp_generated_at: string | null
          otp_verified_at: string | null
          package_pin: string | null
          package_pin_entered_at: string | null
          package_pin_generated_at: string | null
          payment_link_id: string | null
          payout_amount: number
          payout_transferred_at: string | null
          pre_dispute_status: Database["public"]["Enums"]["order_status"] | null
          shipped_at: string | null
          shipping_fee_ksh: number | null
          status: Database["public"]["Enums"]["order_status"]
          stolen_item_reported: boolean | null
          stolen_item_reported_at: string | null
          subtotal_ksh: number
          total_ksh: number
          updated_at: string
          vendor_confirmed: boolean
          vendor_id: string
        }
        Insert: {
          accepted_at?: string | null
          auto_release_at?: string | null
          buyer_confirmed?: boolean
          cancelled_at?: string | null
          commission_amount: number
          commission_rate?: number
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_id?: string | null
          delivered_at?: string | null
          delivery_otp?: string | null
          dispute_id?: string | null
          id?: string
          otp_generated_at?: string | null
          otp_verified_at?: string | null
          package_pin?: string | null
          package_pin_entered_at?: string | null
          package_pin_generated_at?: string | null
          payment_link_id?: string | null
          payout_amount: number
          payout_transferred_at?: string | null
          pre_dispute_status?:
            | Database["public"]["Enums"]["order_status"]
            | null
          shipped_at?: string | null
          shipping_fee_ksh?: number | null
          status?: Database["public"]["Enums"]["order_status"]
          stolen_item_reported?: boolean | null
          stolen_item_reported_at?: string | null
          subtotal_ksh: number
          total_ksh: number
          updated_at?: string
          vendor_confirmed?: boolean
          vendor_id: string
        }
        Update: {
          accepted_at?: string | null
          auto_release_at?: string | null
          buyer_confirmed?: boolean
          cancelled_at?: string | null
          commission_amount?: number
          commission_rate?: number
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_id?: string | null
          delivered_at?: string | null
          delivery_otp?: string | null
          dispute_id?: string | null
          id?: string
          otp_generated_at?: string | null
          otp_verified_at?: string | null
          package_pin?: string | null
          package_pin_entered_at?: string | null
          package_pin_generated_at?: string | null
          payment_link_id?: string | null
          payout_amount?: number
          payout_transferred_at?: string | null
          pre_dispute_status?:
            | Database["public"]["Enums"]["order_status"]
            | null
          shipped_at?: string | null
          shipping_fee_ksh?: number | null
          status?: Database["public"]["Enums"]["order_status"]
          stolen_item_reported?: boolean | null
          stolen_item_reported_at?: string | null
          subtotal_ksh?: number
          total_ksh?: number
          updated_at?: string
          vendor_confirmed?: boolean
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_payment_link_id_fkey"
            columns: ["payment_link_id"]
            isOneToOne: false
            referencedRelation: "payment_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_links: {
        Row: {
          created_at: string | null
          custom_price_ksh: number | null
          custom_title: string | null
          delivery_fee_ksh: number | null
          id: string
          is_active: boolean | null
          product_id: string | null
          short_code: string | null
          updated_at: string | null
          vendor_id: string
        }
        Insert: {
          created_at?: string | null
          custom_price_ksh?: number | null
          custom_title?: string | null
          delivery_fee_ksh?: number | null
          id?: string
          is_active?: boolean | null
          product_id?: string | null
          short_code?: string | null
          updated_at?: string | null
          vendor_id: string
        }
        Update: {
          created_at?: string | null
          custom_price_ksh?: number | null
          custom_title?: string | null
          delivery_fee_ksh?: number | null
          id?: string
          is_active?: boolean | null
          product_id?: string | null
          short_code?: string | null
          updated_at?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_ksh: number
          captured_at: string | null
          created_at: string
          currency: string
          gateway: Database["public"]["Enums"]["payment_gateway"]
          id: string
          metadata: Json | null
          order_id: string
          refunded_at: string | null
          status: Database["public"]["Enums"]["payment_status"]
          transaction_id: string | null
          transaction_reference: string | null
        }
        Insert: {
          amount_ksh: number
          captured_at?: string | null
          created_at?: string
          currency?: string
          gateway: Database["public"]["Enums"]["payment_gateway"]
          id?: string
          metadata?: Json | null
          order_id: string
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          transaction_id?: string | null
          transaction_reference?: string | null
        }
        Update: {
          amount_ksh?: number
          captured_at?: string | null
          created_at?: string
          currency?: string
          gateway?: Database["public"]["Enums"]["payment_gateway"]
          id?: string
          metadata?: Json | null
          order_id?: string
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          transaction_id?: string | null
          transaction_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount_ksh: number
          balance_before: number | null
          commission_amount: number
          failed_at: string | null
          failure_reason: string | null
          fee_paid_by: string | null
          id: string
          metadata: Json | null
          method: Database["public"]["Enums"]["payout_method"]
          net_commission_ksh: number | null
          order_id: string | null
          paid_at: string | null
          processing_at: string | null
          reference: string | null
          requested_at: string
          status: Database["public"]["Enums"]["payout_status"]
          transfer_fee_ksh: number | null
          trigger_type: string | null
          vendor_id: string
        }
        Insert: {
          amount_ksh: number
          balance_before?: number | null
          commission_amount: number
          failed_at?: string | null
          failure_reason?: string | null
          fee_paid_by?: string | null
          id?: string
          metadata?: Json | null
          method: Database["public"]["Enums"]["payout_method"]
          net_commission_ksh?: number | null
          order_id?: string | null
          paid_at?: string | null
          processing_at?: string | null
          reference?: string | null
          requested_at?: string
          status?: Database["public"]["Enums"]["payout_status"]
          transfer_fee_ksh?: number | null
          trigger_type?: string | null
          vendor_id: string
        }
        Update: {
          amount_ksh?: number
          balance_before?: number | null
          commission_amount?: number
          failed_at?: string | null
          failure_reason?: string | null
          fee_paid_by?: string | null
          id?: string
          metadata?: Json | null
          method?: Database["public"]["Enums"]["payout_method"]
          net_commission_ksh?: number | null
          order_id?: string | null
          paid_at?: string | null
          processing_at?: string | null
          reference?: string | null
          requested_at?: string
          status?: Database["public"]["Enums"]["payout_status"]
          transfer_fee_ksh?: number | null
          trigger_type?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "platform_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "public_vendor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      price_alerts: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          notified_at: string | null
          original_price: number
          product_id: string
          target_price: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          notified_at?: string | null
          original_price: number
          product_id: string
          target_price?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          notified_at?: string | null
          original_price?: number
          product_id?: string
          target_price?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_views: {
        Row: {
          id: string
          product_id: string
          source: string | null
          viewed_at: string | null
          visitor_id: string | null
        }
        Insert: {
          id?: string
          product_id: string
          source?: string | null
          viewed_at?: string | null
          visitor_id?: string | null
        }
        Update: {
          id?: string
          product_id?: string
          source?: string | null
          viewed_at?: string | null
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_product_views_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_views_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          apparel_specs: Json | null
          brand: string | null
          category: string | null
          colors: string[] | null
          condition: string | null
          condition_notes: string | null
          created_at: string | null
          description: string | null
          electronics_specs: Json | null
          free_delivery: boolean | null
          id: string
          images: string[] | null
          key_features: string[] | null
          name: string
          price_ksh: number
          short_code: string | null
          sizes: string[] | null
          specs: Json | null
          status: Database["public"]["Enums"]["product_status"] | null
          stock: number | null
          subcategory: string | null
          updated_at: string | null
          vendor_id: string
          video_url: string | null
          views: number | null
        }
        Insert: {
          apparel_specs?: Json | null
          brand?: string | null
          category?: string | null
          colors?: string[] | null
          condition?: string | null
          condition_notes?: string | null
          created_at?: string | null
          description?: string | null
          electronics_specs?: Json | null
          free_delivery?: boolean | null
          id?: string
          images?: string[] | null
          key_features?: string[] | null
          name: string
          price_ksh: number
          short_code?: string | null
          sizes?: string[] | null
          specs?: Json | null
          status?: Database["public"]["Enums"]["product_status"] | null
          stock?: number | null
          subcategory?: string | null
          updated_at?: string | null
          vendor_id: string
          video_url?: string | null
          views?: number | null
        }
        Update: {
          apparel_specs?: Json | null
          brand?: string | null
          category?: string | null
          colors?: string[] | null
          condition?: string | null
          condition_notes?: string | null
          created_at?: string | null
          description?: string | null
          electronics_specs?: Json | null
          free_delivery?: boolean | null
          id?: string
          images?: string[] | null
          key_features?: string[] | null
          name?: string
          price_ksh?: number
          short_code?: string | null
          sizes?: string[] | null
          specs?: Json | null
          status?: Database["public"]["Enums"]["product_status"] | null
          stock?: number | null
          subcategory?: string | null
          updated_at?: string | null
          vendor_id?: string
          video_url?: string | null
          views?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          intasend_wallet_id: string | null
          kyc_documents: Json | null
          kyc_reject_reason: string | null
          kyc_reviewed_at: string | null
          kyc_status: string | null
          kyc_submitted_at: string | null
          kyc_tier: string | null
          mpesa_number: string | null
          signup_source: string | null
          store_description: string | null
          store_link: string | null
          store_logo_url: string | null
          store_name: string | null
          updated_at: string | null
          vendor_address_line1: string | null
          vendor_address_line2: string | null
          vendor_city: string | null
          vendor_county: string | null
          vendor_postal_code: string | null
          whatsapp_number: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          intasend_wallet_id?: string | null
          kyc_documents?: Json | null
          kyc_reject_reason?: string | null
          kyc_reviewed_at?: string | null
          kyc_status?: string | null
          kyc_submitted_at?: string | null
          kyc_tier?: string | null
          mpesa_number?: string | null
          signup_source?: string | null
          store_description?: string | null
          store_link?: string | null
          store_logo_url?: string | null
          store_name?: string | null
          updated_at?: string | null
          vendor_address_line1?: string | null
          vendor_address_line2?: string | null
          vendor_city?: string | null
          vendor_county?: string | null
          vendor_postal_code?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          intasend_wallet_id?: string | null
          kyc_documents?: Json | null
          kyc_reject_reason?: string | null
          kyc_reviewed_at?: string | null
          kyc_status?: string | null
          kyc_submitted_at?: string | null
          kyc_tier?: string | null
          mpesa_number?: string | null
          signup_source?: string | null
          store_description?: string | null
          store_link?: string | null
          store_logo_url?: string | null
          store_name?: string | null
          updated_at?: string | null
          vendor_address_line1?: string | null
          vendor_address_line2?: string | null
          vendor_city?: string | null
          vendor_county?: string | null
          vendor_postal_code?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          last_used_at: string | null
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          last_used_at?: string | null
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          last_used_at?: string | null
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string
          order_id: string | null
          product_id: string
          rating: number
          reviewer_name: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: string
          order_id?: string | null
          product_id: string
          rating: number
          reviewer_name: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: string
          order_id?: string | null
          product_id?: string
          rating?: number
          reviewer_name?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_reviews_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stolen_item_reports: {
        Row: {
          action_taken: string | null
          admin_notes: string | null
          buyer_id: string
          description: string | null
          id: string
          order_id: string
          reported_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          vendor_id: string
        }
        Insert: {
          action_taken?: string | null
          admin_notes?: string | null
          buyer_id: string
          description?: string | null
          id?: string
          order_id: string
          reported_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          vendor_id: string
        }
        Update: {
          action_taken?: string | null
          admin_notes?: string | null
          buyer_id?: string
          description?: string | null
          id?: string
          order_id?: string
          reported_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stolen_item_reports_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendor_balances: {
        Row: {
          created_at: string | null
          id: string
          intasend_wallet_id: string | null
          last_payout_at: string | null
          pending_balance: number | null
          total_earned: number | null
          total_paid_out: number | null
          updated_at: string | null
          vendor_id: string
          wallet_created_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          intasend_wallet_id?: string | null
          last_payout_at?: string | null
          pending_balance?: number | null
          total_earned?: number | null
          total_paid_out?: number | null
          updated_at?: string | null
          vendor_id: string
          wallet_created_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          intasend_wallet_id?: string | null
          last_payout_at?: string | null
          pending_balance?: number | null
          total_earned?: number | null
          total_paid_out?: number | null
          updated_at?: string | null
          vendor_id?: string
          wallet_created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_balances_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_balances_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "public_vendor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_ratings: {
        Row: {
          buyer_id: string
          created_at: string | null
          id: string
          order_id: string
          rating: number
          review: string | null
          updated_at: string | null
          vendor_id: string
        }
        Insert: {
          buyer_id: string
          created_at?: string | null
          id?: string
          order_id: string
          rating: number
          review?: string | null
          updated_at?: string | null
          vendor_id: string
        }
        Update: {
          buyer_id?: string
          created_at?: string | null
          id?: string
          order_id?: string
          rating?: number
          review?: string | null
          updated_at?: string | null
          vendor_id?: string
        }
        Relationships: []
      }
      wishlists: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_vendor_profiles: {
        Row: {
          created_at: string | null
          full_name: string | null
          id: string | null
          kyc_status: string | null
          store_description: string | null
          store_link: string | null
          store_logo_url: string | null
          store_name: string | null
          vendor_city: string | null
          vendor_county: string | null
          whatsapp_number: string | null
        }
        Insert: {
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          kyc_status?: string | null
          store_description?: string | null
          store_link?: string | null
          store_logo_url?: string | null
          store_name?: string | null
          vendor_city?: string | null
          vendor_county?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          kyc_status?: string | null
          store_description?: string | null
          store_link?: string | null
          store_logo_url?: string | null
          store_name?: string | null
          vendor_city?: string | null
          vendor_county?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      vendor_rating_stats: {
        Row: {
          avg_rating: number | null
          rating_count: number | null
          vendor_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      assign_admin_role: { Args: { _user_email: string }; Returns: undefined }
      check_price_drop_alerts: { Args: never; Returns: undefined }
      check_subscription_expiry: { Args: never; Returns: undefined }
      deduct_order_items_stock: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      generate_product_short_code: { Args: never; Returns: string }
      generate_store_link: {
        Args: { name: string; p_id: string }
        Returns: string
      }
      get_guest_order_details: {
        Args: { target_order_id: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      publish_product: {
        Args: { product_id_to_publish: string }
        Returns: undefined
      }
      register_as_vendor: { Args: never; Returns: undefined }
      store_link_base: { Args: { name: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "vendor" | "user" | "revoked_vendor"
      dispute_reason: "no_delivery" | "wrong_item" | "damaged" | "other"
      dispute_status:
        | "open"
        | "under_review"
        | "resolved_refund"
        | "resolved_release"
        | "closed"
      escrow_status: "held" | "released" | "refunded" | "withheld"
      order_status:
        | "pending_vendor_confirmation"
        | "accepted"
        | "dispatched"
        | "shipped"
        | "delivered"
        | "completed"
        | "disputed"
        | "cancelled_by_vendor"
        | "cancelled_by_customer"
        | "refunded"
        | "arrived"
        | "pending_payment"
      payment_gateway:
        | "mpesa"
        | "card"
        | "paypal"
        | "flutterwave"
        | "pesapal"
        | "paystack"
        | "intasend"
      payment_status:
        | "pending"
        | "authorized"
        | "captured"
        | "refunded"
        | "chargeback"
      payout_method: "mpesa" | "bank"
      payout_status: "pending" | "processing" | "paid" | "failed"
      product_status: "active" | "out_of_stock" | "draft" | "paused"
      subscription_plan: "starter" | "growth" | "pro" | "unlimited"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "vendor", "user", "revoked_vendor"],
      dispute_reason: ["no_delivery", "wrong_item", "damaged", "other"],
      dispute_status: [
        "open",
        "under_review",
        "resolved_refund",
        "resolved_release",
        "closed",
      ],
      escrow_status: ["held", "released", "refunded", "withheld"],
      order_status: [
        "pending_vendor_confirmation",
        "accepted",
        "dispatched",
        "shipped",
        "delivered",
        "completed",
        "disputed",
        "cancelled_by_vendor",
        "cancelled_by_customer",
        "refunded",
        "arrived",
        "pending_payment",
      ],
      payment_gateway: [
        "mpesa",
        "card",
        "paypal",
        "flutterwave",
        "pesapal",
        "paystack",
        "intasend",
      ],
      payment_status: [
        "pending",
        "authorized",
        "captured",
        "refunded",
        "chargeback",
      ],
      payout_method: ["mpesa", "bank"],
      payout_status: ["pending", "processing", "paid", "failed"],
      product_status: ["active", "out_of_stock", "draft", "paused"],
      subscription_plan: ["starter", "growth", "pro", "unlimited"],
    },
  },
} as const
