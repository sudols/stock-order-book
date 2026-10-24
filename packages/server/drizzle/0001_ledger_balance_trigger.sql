CREATE OR REPLACE FUNCTION check_ledger_transaction_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_tx_id UUID;
  v_debit_sum NUMERIC(15, 2);
  v_credit_sum NUMERIC(15, 2);
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_tx_id := OLD.transaction_id;
  ELSE
    v_tx_id := NEW.transaction_id;
  END IF;

  -- Sum debits and credits for the modified transaction_id
  SELECT COALESCE(SUM(debit), 0.00), COALESCE(SUM(credit), 0.00)
  INTO v_debit_sum, v_credit_sum
  FROM ledger_entries
  WHERE transaction_id = v_tx_id;

  -- If rows remain for this transaction_id, they must balance exactly
  IF v_debit_sum <> v_credit_sum THEN
    RAISE EXCEPTION 'Double-entry ledger invariant violation: Transaction % is unbalanced (Debits: %, Credits: %, Discrepancy: %)',
      v_tx_id, v_debit_sum, v_credit_sum, (v_debit_sum - v_credit_sum)
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

--> statement-breakpoint
DROP TRIGGER IF EXISTS trigger_check_ledger_balance ON ledger_entries;

--> statement-breakpoint
CREATE CONSTRAINT TRIGGER trigger_check_ledger_balance
AFTER INSERT OR UPDATE OR DELETE ON ledger_entries
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_ledger_transaction_balance();
