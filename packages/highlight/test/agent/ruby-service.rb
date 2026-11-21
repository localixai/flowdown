# frozen_string_literal: true

require "json"

module Billing
  # Charges a customer and records the attempt.
  class ChargeService
    MAX_ATTEMPTS = 3

    attr_reader :customer, :amount

    def initialize(customer:, amount:)
      @customer = customer
      @amount = amount
    end

    def call
      attempts = 0
      begin
        attempts += 1
        response = Gateway.charge(customer.token, amount_cents: (amount * 100).round)
        log(:info, "charged #{customer.email} #{format('%.2f', amount)}")
        response.success?
      rescue Gateway::Timeout => e
        retry if attempts < MAX_ATTEMPTS
        log(:error, e.message)
        false
      end
    end

    def self.valid_email?(email)
      email.match?(/\A[^@\s]+@[^@\s]+\z/)
    end

    private

    def log(level, message)
      puts({ level: level, message: message, at: Time.now.utc }.to_json)
    end
  end
end
