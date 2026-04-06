import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode, SyntheticEvent } from "react";
import { Link, Navigate, Route, Routes, useMatch, useParams } from "react-router-dom";
import { fetchMovieById, fetchMovieReviewsDebug, fetchMovies } from "./services/movieApi";
import type { Movie } from "./types/Movie";
import type { Review } from "./types/Review";

// This helper makes sure user text is treated as plain text, not as a regular-expression command.
function escapeRegex(searchTerm: string): string {
	return searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// This helper wraps matching text in a highlighted marker so search matches are easy to spot.
function highlightText(text: string, searchTerm: string): ReactNode {
	const normalizedSearchTerm = searchTerm.trim()

	if (!normalizedSearchTerm) {
		return text
	}

	const matcher = new RegExp(`(${escapeRegex(normalizedSearchTerm)})`, 'ig')
	const parts = text.split(matcher)

	return parts.map((part, index) => {
		if (part.toLowerCase() === normalizedSearchTerm.toLowerCase()) {
			return (
				<mark key={`match-${part}-${index}`} className="rounded-md bg-yellow-300 px-1 py-0.5 font-semibold text-slate-950 ring-1 ring-yellow-500/60">
					{part}
				</mark>
			)
		}

		return <span key={`plain-${part}-${index}`}>{part}</span>
	})
}

// Converts runtime in minutes into a human-friendly sentence.
function formatRuntime(runtime: number): string {
	if (!runtime || runtime <= 0) {
		return 'Runtime unavailable'
	}

	const hours = Math.floor(runtime/60)
	const minutes = runtime%60

	if (hours === 0) {
		return `${minutes} minutes`
	}

	return `${hours} hours ${minutes} minutes`
}

// Converts API date values into a readable date format for people.
function formatDate(dateValue: string): string {
	const date = new Date(dateValue)

	if (Number.isNaN(date.getTime())) {
		return 'Date unavailable'
	}

	return date.toLocaleDateString(undefined, {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	})
}

// Applies colour styles to ratings so strong and weak ratings are visually distinct.
function scoreTone(score: number): string {
	if (score >= 4) {
		return 'bg-emerald-100 text-emerald-700 ring-emerald-300'
	}

	if (score >= 2.5) {
		return 'bg-amber-100 text-amber-700 ring-amber-300'
	}

	return 'bg-rose-100 text-rose-700 ring-rose-300'
}

// Replaces broken images with a safe placeholder so the layout remains stable.
function handleImageFallback(event: SyntheticEvent<HTMLImageElement>): void {
	event.currentTarget.src = 'https://placehold.co/400x600/f1f5f9/334155?text=Poster+Unavailable'
}

interface AppShellProps {
	children: ReactNode
	headerEyebrow?: string
	headerTitle: string
	headerSubtitle: string
	searchInput: string
	searchPlaceholder: string
	onSearchInputChange: (searchValue: string) => void
	onSearchSubmit: () => void
	onSearchClear: () => void
}

// Shared page frame that keeps one consistent header, search bar and footer across routes.
function AppShell({
	children,
	headerEyebrow,
	headerTitle,
	headerSubtitle,
	searchInput,
	searchPlaceholder,
	onSearchInputChange,
	onSearchSubmit,
	onSearchClear,
}: AppShellProps) {
	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		onSearchSubmit()
	}

	return (
		<div className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
			<header className="fade-up mb-8 rounded-3xl border border-amber-200/70 bg-white/85 px-6 py-6 shadow-lg shadow-amber-100/60 backdrop-blur">
				<div>
					{headerEyebrow ? (
						<p className="text-sm font-semibold uppercase tracking-[0.2em] text-rose-600">{headerEyebrow}</p>
					) : null}
					<h1 className="mt-2 text-4xl leading-tight text-slate-900">{headerTitle}</h1>
					<p className="mt-2 text-slate-600">
						{headerSubtitle}
					</p>
				</div>

				<form className="mt-5 flex w-full flex-col gap-3 sm:flex-row" onSubmit={handleSubmit}>
					<input
						type="search"
						value={searchInput}
						onChange={(event) => onSearchInputChange(event.target.value)}
						placeholder={searchPlaceholder}
						className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none ring-amber-300 transition focus:ring-2"
					/>
					<button
						type="submit"
						className="rounded-xl bg-[#0D6EFD] bg-900 cursor-pointer px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#0A58CA] bg-700"
					>
						Go
					</button>
					<button
						type="button"
						onClick={onSearchClear}
						className="rounded-xl border border-slate-300 cursor-pointer bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-[#6C757D] bg-100 hover:text-white"
					>
						Clear
					</button>
				</form>
			</header>

			{children}

			<footer className="mt-10 pb-4 text-center text-sm text-slate-500">
				Built for WEBD3000 subject (Sprint 4) using React, Tailwind CSS, TypeScript and the C# A.P.I built in the previous sprint.
				</footer>
		</div>
	)
}


// Home page: fetches all movies and filters them using the home-page search term
function HomePage({ searchTerm }: { searchTerm: string }) {
	const [movies, setMovies] = useState<Movie[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [errorMessage, setErrorMessage] = useState('')
	const normalizedSearchTerm = searchTerm.trim().toLowerCase()

	const filteredMovies = useMemo(() => {
		if (!normalizedSearchTerm) {
			return movies
		}

		return movies.filter((movie) => {
			const averageScore = movie.averageCriticScore ?? 0
			const runtimeText = formatRuntime(movie.runtime)
			const releaseDateText = formatDate(movie.releaseDate)
			const searchableText = [
				movie.title,
				movie.synopsis,
				movie.genre ?? '',
				averageScore.toString(),
				averageScore.toFixed(1),
				movie.runtime.toString(),
				runtimeText,
				movie.releaseDate,
				releaseDateText,
			].join(' ').toLowerCase()

			return searchableText.includes(normalizedSearchTerm)
		})
	}, [movies, normalizedSearchTerm])

	useEffect(() => {
		let isMounted = true

		const loadMovies = async () => {
			try {
				setIsLoading(true)
				const allMovies = await fetchMovies()

				if (isMounted) {
					setMovies(allMovies)
				}
			} catch {
				if (isMounted) {
					setErrorMessage('Unable to load movies from the A.P.I. Please check your backend server and try again.')
				}
			} finally {
				if (isMounted) {
					setIsLoading(false)
				}
			}
		}

		void loadMovies()

		return () => {
			isMounted = false
		}
	}, [])

	return (
		<section className="fade-up">
			{isLoading ? (
				<div className="rounded-2xl border border-slate-200 bg-white/90 p-8 text-center text-slate-600 shadow-sm">
					Loading movies...
				</div>
			) : null}

			{!isLoading && errorMessage ? (
				<div className="rounded-2xl border border-rose-300 bg-rose-50 p-6 text-rose-700">{errorMessage}</div>
			) : null}

			{!isLoading && !errorMessage ? (
				<div className="space-y-4">
					{filteredMovies.length === 0 ? (
						<div className="rounded-2xl border border-slate-200 bg-white/90 p-8 text-center text-slate-600 shadow-sm">
							No movies matched your search. Try another keyword.
						</div>
					) : (
						<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
							{filteredMovies.map((movie, index) => {
						const score = movie.averageCriticScore ?? 0

						return (
							<Link
								key={movie.id}
								to={`/movies/${movie.id}`}
								className="group fade-up overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 shadow-md shadow-slate-200/60 transition hover:-translate-y-1 hover:shadow-xl"
								style={{ animationDelay: `${index * 80}ms` }}
							>
								<div className="relative h-96 overflow-hidden bg-slate-100">
									<img
										src={movie.image}
										alt={`${movie.title} poster`}
										className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
										onError={handleImageFallback}
									/>
									<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/80 to-transparent p-4">
										<span
											className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${scoreTone(score)}`}
										>
											Critics rating: {score.toFixed(1)}/5
										</span>
									</div>
								</div>

								<div className="space-y-2 px-5 py-4">
									<h2 className="text-2xl text-slate-900">{highlightText(movie.title, searchTerm)}</h2>
									<p className="line-clamp-3 text-sm text-slate-600">{highlightText(movie.synopsis, searchTerm)}</p>
								</div>
							</Link>
						)
							})}
						</div>
					)}
				</div>
			) : null}
		</section>
	)
}

// Movie details webpage: loads one movie and its reviews then highlights matching details-page search text
function MovieDetailsPage({ searchTerm }: { searchTerm: string }) {
	const { movieId } = useParams<{ movieId: string }>()
	const [movie, setMovie] = useState<Movie | null>(null)
	const [reviews, setReviews] = useState<Review[]>([])
	const [rawReviewsPayload, setRawReviewsPayload] = useState<unknown>(null)
	const [reviewsEndpointUsed, setReviewsEndpointUsed] = useState<string | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [errorMessage, setErrorMessage] = useState('')

	useEffect(() => {
		if (!movieId) {
			return
		}

		let isMounted = true

		const loadDetails = async () => {
			try {
				setIsLoading(true)
				const [movieDetails, reviewsDebug] = await Promise.all([
					fetchMovieById(movieId),
					fetchMovieReviewsDebug(movieId),
				])

				if (isMounted) {
					setMovie(movieDetails)
					setReviews(reviewsDebug.reviews)
					setRawReviewsPayload(reviewsDebug.rawPayload)
					setReviewsEndpointUsed(reviewsDebug.requestedPath)
				}
			} catch {
				if (isMounted) {
					setErrorMessage('Unable to load this movie and its reviews from the A.P.I.')
					setRawReviewsPayload(null)
					setReviewsEndpointUsed(null)
				}
			} finally {
				if (isMounted) {
					setIsLoading(false)
				}
			}
		}

		void loadDetails()

		return () => {
			isMounted = false
		}
	}, [movieId])

	const normalizedReviewSearchTerm = searchTerm.trim().toLowerCase()
	const detailHighlightTerm = searchTerm.trim()

	const filteredReviews = useMemo(() => {
		if (!normalizedReviewSearchTerm) {
			return reviews
		}

		return reviews.filter((review) => {
			const scoreText = typeof review.score === 'number' ? `${review.score} ${review.score.toFixed(1)}` : ''
			const searchableText = [
				review.title ?? '',
				review.criticName,
				review.comment,
				review.publishedAt ?? '',
				review.timePublishedAgo ?? '',
				scoreText,
			].join(' ').toLowerCase()

			return searchableText.includes(normalizedReviewSearchTerm)
		})
	}, [reviews, normalizedReviewSearchTerm])

	const reviewsToDisplay = useMemo(() => {
		if (!normalizedReviewSearchTerm) {
			return reviews
		}

		return filteredReviews.length > 0 ? filteredReviews : reviews
	}, [reviews, filteredReviews, normalizedReviewSearchTerm])

	useEffect(() => {
		if (!movieId) {
			return
		}

		console.log('[MovieReviews Debug]', {
			movieId,
			reviewsEndpointUsed: reviewsEndpointUsed ?? 'No matching endpoint returned data',
			rawReviewsPayload,
		})
	}, [movieId, rawReviewsPayload, reviewsEndpointUsed])

	const averageScore = useMemo(() => {
		if (movie?.averageCriticScore !== undefined) {
			return movie.averageCriticScore
		}

		const scoredReviews = reviews.filter(
			(review): review is Review & { score: number } => typeof review.score === 'number' && Number.isFinite(review.score),
		)

		if (scoredReviews.length === 0) {
			return 0
		}

		const total = scoredReviews.reduce((sum, review) => sum + review.score, 0)
		return Number((total / scoredReviews.length).toFixed(1))
	}, [movie, reviews])

	if (!movieId) {
		return <Navigate to="/" replace />
	}

	return (
		<section className="fade-up space-y-6">
			<Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900 underline">
				Back to all movies
			</Link>

			{isLoading ? (
				<div className="rounded-2xl border border-slate-200 bg-white/90 p-8 text-center text-slate-600 shadow-sm">
					Loading movie details...
				</div>
			) : null}

			{!isLoading && errorMessage ? (
				<div className="rounded-2xl border border-rose-300 bg-rose-50 p-6 text-rose-700">{errorMessage}</div>
			) : null}

			{!isLoading && !errorMessage && movie ? (
				<div className="space-y-6">
					<article className="grid overflow-hidden rounded-3xl border border-slate-200 bg-white/95 shadow-lg shadow-slate-200/70 md:grid-cols-[300px_1fr]">
						<div className="bg-slate-100">
							<img
								src={movie.image}
								alt={`${movie.title} poster`}
								className="h-full w-full object-cover"
								onError={handleImageFallback}
							/>
						</div>

						<div className="space-y-5 p-6">
							<div className="flex flex-wrap items-center gap-3">
								<h2 className="text-4xl text-slate-900">{highlightText(movie.title, detailHighlightTerm)}</h2>
								<span className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${scoreTone(averageScore)}`}>
									Average rating: {averageScore.toFixed(1)}/5
								</span>
							</div>

							<p className="text-slate-700">{highlightText(movie.synopsis, detailHighlightTerm)}</p>

							<dl className="grid grid-cols-1 gap-4 text-sm text-slate-600 sm:grid-cols-2">
								<div className="rounded-xl bg-amber-50 p-4">
									<dt className="font-semibold uppercase tracking-wide text-amber-700">Runtime</dt>
									<dd className="mt-1 text-slate-800">{highlightText(formatRuntime(movie.runtime), detailHighlightTerm)}</dd>
								</div>

								<div className="rounded-xl bg-orange-50 p-4">
									<dt className="font-semibold uppercase tracking-wide text-orange-700">Release Date</dt>
									<dd className="mt-1 text-slate-800">{highlightText(formatDate(movie.releaseDate), detailHighlightTerm)}</dd>
								</div>
							</dl>
						</div>
					</article>

					<article className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-md shadow-slate-200/60">
						<h3 className="text-3xl text-slate-900">Published Critic Reviews</h3>

						{reviews.length === 0 ? (
							<p className="mt-4 rounded-xl bg-slate-50 p-4 text-slate-600">
								No published critic reviews are available for this movie yet.
							</p>
						) : (
							<div className="mt-5 space-y-4">
								{reviewsToDisplay.map((review) => {
									const hasScore = typeof review.score === 'number' && Number.isFinite(review.score)
									const publishedLabel = review.timePublishedAgo || (review.publishedAt ? formatDate(review.publishedAt) : '')

									return (
										<article
											key={review.id}
											className="rounded-2xl border border-slate-200/90 bg-white px-5 py-4 transition hover:border-slate-300"
										>
											{review.title ? (
												<p className="text-base font-semibold text-slate-900">{highlightText(review.title, detailHighlightTerm)}</p>
											) : null}

											<div className="mt-1 flex flex-wrap items-center justify-between gap-2">
												<p className="text-lg font-semibold text-slate-900">{highlightText(review.criticName, detailHighlightTerm)}</p>
												{hasScore ? (
													<span className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${scoreTone(review.score ?? 0)}`}>
														{(review.score ?? 0).toFixed(1)} / 5
													</span>
												) : null}
											</div>

											{publishedLabel ? (
												<p className="mt-2 text-xs uppercase tracking-wide text-slate-500">{highlightText(publishedLabel, detailHighlightTerm)}</p>
											) : null}

											<p className="mt-3 text-slate-700">{highlightText(review.comment, detailHighlightTerm)}</p>
										</article>
									)
								})}
							</div>
						)}
					</article>

				</div>
			) : null}
		</section>
	)
}

// Top-level route controller that keeps separate search state for the homepage and each movie details webpage
export default function App() {
	const [homeSearchInput, setHomeSearchInput] = useState('')
	const [homeSearchTerm, setHomeSearchTerm] = useState('')
	const [detailsSearchInput, setDetailsSearchInput] = useState('')
	const [detailsSearchTerm, setDetailsSearchTerm] = useState('')

	const movieDetailsMatch = useMatch('/movies/:movieId')
	const movieId = movieDetailsMatch?.params.movieId ?? ''
	const isMovieDetailsRoute = Boolean(movieDetailsMatch)

	useEffect(() => {
		if (!movieId) {
			return
		}

		setDetailsSearchInput('')
		setDetailsSearchTerm('')
	}, [movieId])

	const activeSearchInput = isMovieDetailsRoute ? detailsSearchInput : homeSearchInput
	const activeHeaderEyebrow = isMovieDetailsRoute ? '' : 'Find a movie'
	const activeHeaderTitle = isMovieDetailsRoute ? 'Movie Details Search' : 'MovieReviews'
	const activeHeaderSubtitle = isMovieDetailsRoute
		? 'Search this movie details and reviews by title, synopsis, critic or publish date.'
		: 'Explore movies, compare critic ratings and read published reviews in one clean place.'
	const activeSearchPlaceholder = isMovieDetailsRoute
		? "Search this movie details and reviews by title, synopsis, critic, rating or publish date..."
		: "Search by title, synopsis, genre, rating, runtime or release date..."

	const handleSearchInputChange = (value: string) => {
		if (isMovieDetailsRoute) {
			setDetailsSearchInput(value)
			return
		}

		setHomeSearchInput(value)
	}

	const handleSearchSubmit = () => {
		if (isMovieDetailsRoute) {
			setDetailsSearchTerm(detailsSearchInput.trim())
			return
		}

		setHomeSearchTerm(homeSearchInput.trim())
	}

	const handleSearchClear = () => {
		if (isMovieDetailsRoute) {
			setDetailsSearchInput('')
			setDetailsSearchTerm('')
			return
		}

		setHomeSearchInput('')
		setHomeSearchTerm('')
	}

	return (
		<AppShell
			headerEyebrow={activeHeaderEyebrow}
			headerTitle={activeHeaderTitle}
			headerSubtitle={activeHeaderSubtitle}
			searchInput={activeSearchInput}
			searchPlaceholder={activeSearchPlaceholder}
			onSearchInputChange={handleSearchInputChange}
			onSearchSubmit={handleSearchSubmit}
			onSearchClear={handleSearchClear}
		>
			<Routes>
				<Route path="/" element={<HomePage searchTerm={homeSearchTerm} />} />
				<Route path="/movies/:movieId" element={<MovieDetailsPage searchTerm={detailsSearchTerm} />} />
				<Route path="*" element={<Navigate to="/" replace />} />
			</Routes>
		</AppShell>
	)
}
