export interface PaginationParams {
  page?: number
  limit?: number
  sort?: 'asc' | 'desc'
  year?: string
}

export const resolvePagination = (params: PaginationParams) => {
  return {
    page: params.page ? Number(params.page) : 1,
    limit: params.limit ? Number(params.limit) : 5,
    sort: params.sort || 'asc',
  }
}

export function parseSortingCriteria(sort: string): [string, string] {
  if (!sort) {
    return ['created_at', 'desc']; 
  }

  const parts = sort.split(':')
  if (parts.length === 2) {
    const [field, order] = parts
    return [field, order]
  } else {
    return ['created_at', sort]
  }
}
