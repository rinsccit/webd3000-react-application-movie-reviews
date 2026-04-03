import type { Movie } from '../types/Movie'
import type { Review } from '../types/Review'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

class ApiResponseError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getField(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const value = record[key]
    if (value !== undefined && value !== null) {
      return value
    }
  }

  return undefined
}

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number') {
    return String(value)
  }

  return fallback
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return fallback
}

function asBoolean(value: unknown, fallback = true): boolean {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'string') {
    const lowerValue = value.toLowerCase()

    if (lowerValue === 'true' || lowerValue === 'published' || lowerValue === 'active') {
      return true
    }

    if (lowerValue === 'false' || lowerValue === 'draft' || lowerValue === 'unpublished' || lowerValue === 'inactive') {
      return false
    }
  }

  return fallback
}

function getArrayPayload(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload
  }

  if (!isRecord(payload)) {
    return []
  }

  const candidates = ['data', 'items', 'results', 'value', 'movies', 'reviews']

  for (const key of candidates) {
    const value = payload[key]
    if (Array.isArray(value)) {
      return value
    }
  }

  return []
}

function getObjectPayload(payload: unknown): Record<string, unknown> | null {
  if (isRecord(payload)) {
    if ('id' in payload || 'title' in payload || 'synopsis' in payload) {
      return payload
    }

    const candidates = ['data', 'item', 'result', 'movie', 'review']

    for (const key of candidates) {
      const value = payload[key]
      if (isRecord(value)) {
        return value
      }
    }
  }

  if (Array.isArray(payload) && payload.length > 0 && isRecord(payload[0])) {
    return payload[0]
  }

  return null
}

function normalizeMovie(rawMovie: Record<string, unknown>): Movie {
  const imageValue = asString(getField(rawMovie, ["image", "imageUrl", "poster", "posterUrl", "posterImage"]))

  return {
    id: asString(getField(rawMovie, ["id", "movieId", "_id"]), crypto.randomUUID()),
    title: asString(getField(rawMovie, ["title", "name"]), "Untitled Movie"),
    image: imageValue || "https://placehold.co/400x600?text=No+Poster",
    synopsis: asString(getField(rawMovie, ["synopsis", "description", "summary"]), "No synopsis available yet."),
    runtime: asNumber(getField(rawMovie, ["runtime", "duration"]), 0),
    releaseDate: asString(getField(rawMovie, ["releaseDate", "releasedAt", "release"]), ""),
    createdBy: asString(getField(rawMovie, ["createdBy", "author", "owner"]), "Administrator"),
    averageCriticScore: asNumber(getField(rawMovie, ["averageCriticScore", "averageScore", "averageRating"]), NaN),
  }
}

function normalizeReview(rawReview: Record<string, unknown>, movieId: string): Review {
  return {
    id: asString(getField(rawReview, ["id", "reviewId", "_id"]), crypto.randomUUID()),
    movieId: asString(getField(rawReview, ["movieId", "movie"]), movieId),
    criticName: asString(getField(rawReview, ["criticName", "critic", "reviewerName", "createdBy"]), "Anonymous Critic"),
    score: asNumber(getField(rawReview, ["score", "rating", "criticScore"]), 0),
    comment: asString(getField(rawReview, ["comment", "reviewText", "content", "body"]), "No written review available."),
    isPublished: asBoolean(getField(rawReview, ["isPublished", "published", "status"]), true),
    publishedAt: asString(getField(rawReview, ["publishedAt", "createdAt", "updatedAt"]), ""),
  }
}

function getAverageScore(reviews: Review[]): number {
  if (reviews.length === 0) {
    return 0
  }

  const total = reviews.reduce((sum, review) => sum + review.score, 0)
  return Number((total/reviews.length).toFixed(1))
}

async function requestJson(path: string): Promise<unknown> {
  const response = await fetch(path)

  if (!response.ok) {
    throw new ApiResponseError(`Request failed: ${path}`, response.status)
  }

  if (response.status === 204) {
    return null
  }

  const responseText = await response.text()

  if (!responseText.trim()) {
    return null
  }

  return JSON.parse(responseText) as unknown
}

async function requestFirstAvailable(paths: string[]): Promise<unknown> {
  let lastError: unknown = null

  for (const path of paths) {
    try {
      return await requestJson(path)
    } catch (error) {
      lastError = error
      if (error instanceof ApiResponseError && error.status === 404) {
        continue
      }

      throw error
    }
  }

  throw lastError ?? new Error('No endpoint returned data.')
}

export async function fetchMovies(): Promise<Movie[]> {
  const payload = await requestJson(`${API_BASE_URL}/movies`)
  const rawMovies = getArrayPayload(payload).filter(isRecord)

  const movies = rawMovies.map(normalizeMovie)

  const withAverageScores = await Promise.all(
    movies.map(async (movie) => {
      if (typeof movie.averageCriticScore === 'number' && Number.isFinite(movie.averageCriticScore)) {
        return movie
      }

      try {
        const reviews = await fetchMovieReviews(movie.id)
        return {
          ...movie,
          averageCriticScore: getAverageScore(reviews),
        }
      } catch {
        return {
          ...movie,
          averageCriticScore: 0,
        }
      }
    }),
  )

  return withAverageScores
}

export async function fetchMovieById(movieId: string): Promise<Movie> {
  const payload = await requestFirstAvailable([
    `${API_BASE_URL}/movies/${movieId}`,
    `${API_BASE_URL}/movies/details/${movieId}`,
  ])

  const rawMovie = getObjectPayload(payload)

  if (!rawMovie) {
    throw new Error('Movie not found.')
  }

  const movie = normalizeMovie(rawMovie)

  if (typeof movie.averageCriticScore === 'number' && Number.isFinite(movie.averageCriticScore)) {
    return movie
  }

  const reviews = await fetchMovieReviews(movieId)
  return {
    ...movie,
    averageCriticScore: getAverageScore(reviews),
  }
}

export async function fetchMovieReviews(movieId: string): Promise<Review[]> {
  let payload: unknown

  try {
    payload = await requestFirstAvailable([
      `${API_BASE_URL}/movies/${movieId}/reviews`,
      `${API_BASE_URL}/reviews/movie/${movieId}`,
      `${API_BASE_URL}/reviews?movieId=${encodeURIComponent(movieId)}`,
    ])
  } catch (error) {
    if (error instanceof ApiResponseError && error.status === 404) {
      return []
    }

    throw error
  }

  const rawReviews = getArrayPayload(payload).filter(isRecord)

  return rawReviews
    .map((rawReview) => normalizeReview(rawReview, movieId))
    .filter((review) => review.isPublished)
    .sort((a, b) => {
      const aDate = Date.parse(a.publishedAt ?? '')
      const bDate = Date.parse(b.publishedAt ?? '')

      if (Number.isNaN(aDate) && Number.isNaN(bDate)) {
        return 0
      }

      if (Number.isNaN(aDate)) {
        return 1
      }

      if (Number.isNaN(bDate)) {
        return -1
      }

      return bDate - aDate
    })
}
