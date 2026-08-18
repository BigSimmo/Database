// tests/caring-contacts-repository.test.ts
//
// The shared store contract, run against the in-memory implementation. Task 11 adds a second thin
// file that calls the same function with the Postgres factory, so neither store can drift from the
// other's behaviour.
import { createInMemoryRepository } from "@/lib/caring-contacts/in-memory-repository";

import { describeCaringContactRepositoryContract } from "./helpers/caring-contacts-repository-contract";

describeCaringContactRepositoryContract("in-memory", createInMemoryRepository);
