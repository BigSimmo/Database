export type SearchRequestToken = number;

export function nextSearchRequestToken(current: SearchRequestToken): SearchRequestToken {
  return current + 1;
}

export function invalidateSearchRequests(current: SearchRequestToken): SearchRequestToken {
  return nextSearchRequestToken(current);
}

export function isLatestSearchRequest(requestId: SearchRequestToken, latest: SearchRequestToken): boolean {
  return requestId === latest;
}
