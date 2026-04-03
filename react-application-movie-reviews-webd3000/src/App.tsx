//import { BlobServiceClient } from "@azure/storage-blob";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode, SyntheticEvent } from "react";
import { Link, Navigate, Route, Routes, useParams } from "react-router-dom";
import { fetchMovieById, fetchMovieReviews, fetchMovies } from "./services/movieApi";
import type { Movie } from "./types/Movie";
import type { Review } from "./types/Review";

function escapeRegex(searchTerm: string): string {
	return searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

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
				<mark key={`match-${part}-${index}`} className="rounded bg-200 bg-[#FFCCD2] px-0.5 text-slate-900">
					{part}
				</mark>
			)
		}

		return <span key={`plain-${part}-${index}`}>{part}</span>
	})
}

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

function scoreTone(score: number): string {
	if (score >= 4) {
		return 'bg-emerald-100 text-emerald-700 ring-emerald-300'
	}

	if (score >= 2.5) {
		return 'bg-amber-100 text-amber-700 ring-amber-300'
	}

	return 'bg-rose-100 text-rose-700 ring-rose-300'
}

function handleImageFallback(event: SyntheticEvent<HTMLImageElement>): void {
	event.currentTarget.src = 'https://placehold.co/400x600/f1f5f9/334155?text=Poster+Unavailable'
}

interface AppShellProps {
	children: ReactNode
	searchInput: string
	onSearchInputChange: (searchValue: string) => void
	onSearchSubmit: () => void
	onSearchClear: () => void
}

function AppShell({
	children,
	searchInput,
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
					{/*<p className="text-sm font-semibold uppercase tracking-[0.2em] text-rose-600">Movie Reviews</p>*/}
					<h1 className="mt-2 text-4xl leading-tight text-slate-900">MovieReviews</h1>
					<p className="mt-2 text-slate-600">
						Explore movies, compare critic ratings and read published reviews in one clean place.
					</p>
				</div>

				<form className="mt-5 flex w-full flex-col gap-3 sm:flex-row" onSubmit={handleSubmit}>
					<input
						type="search"
						value={searchInput}
						onChange={(event) => onSearchInputChange(event.target.value)}
						placeholder="Search movie title or synopsis"
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
				Built for WEBD3000 Sprint 4 using React, TypeScript, Tailwind CSS, and your C# API.
			</footer>
		</div>
	)
}


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
			const searchableText = `${movie.title} ${movie.synopsis}`.toLowerCase()
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
					{normalizedSearchTerm ? (
						<p className="rounded-xl border border-slate-200 bg-white/85 px-4 py-3 text-sm text-slate-700">
							Found {filteredMovies.length} result(s) for "{searchTerm.trim()}".
						</p>
					) : null}

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
											{score.toFixed(1)} / 5 Critics
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

function MovieDetailsPage() {
	const { movieId } = useParams<{ movieId: string }>()
	const [movie, setMovie] = useState<Movie | null>(null)
	const [reviews, setReviews] = useState<Review[]>([])
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
				const [movieDetails, movieReviews] = await Promise.all([
					fetchMovieById(movieId),
					fetchMovieReviews(movieId),
				])

				if (isMounted) {
					setMovie(movieDetails)
					setReviews(movieReviews)
				}
			} catch {
				if (isMounted) {
					setErrorMessage('Unable to load this movie and its reviews from the A.P.I.')
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

	const averageScore = useMemo(() => {
		if (movie?.averageCriticScore !== undefined) {
			return movie.averageCriticScore
		}

		if (reviews.length === 0) {
			return 0
		}

		const total = reviews.reduce((sum, review) => sum + review.score, 0)
		return Number((total / reviews.length).toFixed(1))
	}, [movie, reviews])

	if (!movieId) {
		return <Navigate to="/" replace />
	}

	return (
		<section className="fade-up space-y-6">
			<Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900">
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
								<h2 className="text-4xl text-slate-900">{movie.title}</h2>
								<span className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${scoreTone(averageScore)}`}>
									{averageScore.toFixed(1)} / 5 Average
								</span>
							</div>

							<p className="text-slate-700">{movie.synopsis}</p>

							<dl className="grid grid-cols-1 gap-4 text-sm text-slate-600 sm:grid-cols-2">
								<div className="rounded-xl bg-amber-50 p-4">
									<dt className="font-semibold uppercase tracking-wide text-amber-700">Runtime</dt>
									<dd className="mt-1 text-slate-800">{formatRuntime(movie.runtime)}</dd>
								</div>

								<div className="rounded-xl bg-orange-50 p-4">
									<dt className="font-semibold uppercase tracking-wide text-orange-700">Release Date</dt>
									<dd className="mt-1 text-slate-800">{formatDate(movie.releaseDate)}</dd>
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
								{reviews.map((review) => (
									<article
										key={review.id}
										className="rounded-2xl border border-slate-200/90 bg-white px-5 py-4 transition hover:border-slate-300"
									>
										<div className="flex flex-wrap items-center justify-between gap-2">
											<p className="text-lg font-semibold text-slate-900">{review.criticName}</p>
											<span className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${scoreTone(review.score)}`}>
												{review.score.toFixed(1)} / 5
											</span>
										</div>
										<p className="mt-3 text-slate-700">{review.comment}</p>
									</article>
								))}
							</div>
						)}
					</article>
				</div>
			) : null}
		</section>
	)
}

export default function App() {
	const [searchInput, setSearchInput] = useState('')
	const [searchTerm, setSearchTerm] = useState('')

	const handleSearchSubmit = () => {
		setSearchTerm(searchInput.trim())
	}

	const handleSearchClear = () => {
		setSearchInput('')
		setSearchTerm('')
	}

	return (
		<AppShell
			searchInput={searchInput}
			onSearchInputChange={setSearchInput}
			onSearchSubmit={handleSearchSubmit}
			onSearchClear={handleSearchClear}
		>
			<Routes>
				<Route path="/" element={<HomePage searchTerm={searchTerm} />} />
				<Route path="/movies/:movieId" element={<MovieDetailsPage />} />
				<Route path="*" element={<Navigate to="/" replace />} />
			</Routes>
		</AppShell>
	)
}
