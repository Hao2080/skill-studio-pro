export interface MockTrashResult {
  operationId: string;
  status: "mock_success";
}

export async function restoreMockTrashEntry(_entryId: string): Promise<MockTrashResult> {
  return { operationId: "mock-restore-01", status: "mock_success" };
}

export async function purgeMockTrashEntry(_entryId: string, _confirmation: string): Promise<MockTrashResult> {
  return { operationId: "mock-purge-01", status: "mock_success" };
}
