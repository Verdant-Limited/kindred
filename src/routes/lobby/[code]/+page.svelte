<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabaseClient';
	import { slide } from 'svelte/transition';
	import { memoize } from 'lodash-es';

	interface Song {
		id: number;
		title: string;
		lyrics: string;
		category_id?: number;
	}

	// Add error type
	type ErrorType = string | null;

	// Add these type definitions at the top of the script
	interface QueueOperations {
		addToQueue: (song: Song) => void;
		removeFromQueue: (index: number) => void;
	}

	// State management
	let showSearch = false;
	let showLyrics = false;
	let searchQuery = '';
	let songs: Song[] = [];
	let queue: Song[] = [];
	let lyrics = '';
	let currentSong = '';
	let isLoading = false;
	let error: ErrorType = null;

	onMount(async () => {
		try {
			isLoading = true;
			const { data, error: apiError } = await supabase
				.from('songs') // Changed from 'prayers_songs' to 'songs'
				.select(
					`
					id,
					title,
					lyrics,
					category_id
				`
				)
				.limit(5);

			if (apiError) {
				console.error('Supabase error:', apiError);
				throw apiError;
			}

			if (!data || data.length === 0) {
				console.error('No songs data returned');
				throw new Error('No songs found');
			}

			songs = data;
			console.log('✅ Songs loaded:', songs.length, songs);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load songs';
			console.error('❌ Error:', error);
		} finally {
			isLoading = false;
		}
	});

	const queueOperations: QueueOperations = {
		addToQueue: (song: Song) => {
			if (!queue.some((s) => s.id === song.id)) {
				queue = [...queue, song];
			}
		},
		removeFromQueue: (index: number) => {
			queue = [...queue.slice(0, index), ...queue.slice(index + 1)];
		}
	};

	const filterSongs = memoize((songs: Song[], query: string): Song[] => {
		if (!query?.trim()) return songs;
		const searchTerm = query.toLowerCase().trim();
		return songs.filter((song) => song.title.toLowerCase().includes(searchTerm));
	});

	async function fetchLyrics(song: Song) {
		lyrics = song.lyrics;
		currentSong = song.title;
		showLyrics = true;
	}

	$: filteredSongs = filterSongs(songs, searchQuery);
	$: currentSongDisplay = queue[0]?.title || '';
</script>

<!-- Header -->
<div class="flex items-center justify-between px-3 py-4">
	<h1 class="pt-6 pl-6 font-sans text-xl font-semibold tracking-widest text-black">
		Program Title
	</h1>
	<button class="material-symbols-outlined share cursor-pointer pt-6 pr-6" aria-label="Share">
		share
	</button>
</div>

<!-- Search Input -->
<div class="mt-2 flex flex-col items-center justify-center">
	<div class="relative w-80">
		<input
			on:click={() => (showSearch = true)}
			type="text"
			maxlength="20"
			placeholder="Search for Prayer or Song..."
			class="h-15 w-full rounded-[20px] bg-stone-300 pl-10 font-sans text-gray-400 shadow-[0_4px_4px_0_rgba(0,0,0,0.25)] hover:bg-stone-200" />
		<span
			class="material-symbols-outlined flame absolute top-1/2 left-1 -translate-y-1/2 transform text-black">
			local_fire_department
		</span>
	</div>
	<h2 class="mt-20 text-center font-sans text-[30px] leading-tight font-bold tracking-wide">
		Program Title<br />
	</h2>
	<p class="mt-30 font-sans font-semibold">LYRICS</p>
	<div class="mt-4 flex items-center justify-center">
		<button
			class="material-symbols-outlined arrow flex h-7 w-12 cursor-pointer items-center justify-center rounded-[10px] bg-white pb-8 text-center text-orange-400 shadow-[0_4px_4px_0_rgba(0,0,0,0.25)] hover:bg-gray-200"
			on:click={() => (showLyrics = true)}>keyboard_arrow_up</button>
	</div>
</div>

<!-- Queue Section -->
<section class="mt-10 px-20 py-4">
	<div class="flex items-center justify-between">
		<h2 class="font-sans text-[10px] font-bold tracking-wide">QUEUED</h2>
		<span class="mr-39 h-6 w-6 rounded-full bg-white pl-1.5 font-semibold">
			{queue.length}
		</span>
		<button
			on:click={() => (showSearch = true)}
			class="material-symbols-outlined add mb-1 h-7 w-10 cursor-pointer rounded-[20px]
                   bg-gray-300 shadow-[0_4px_4px_0_rgba(0,0,0,0.25)] hover:bg-white"
			aria-label="Add song">
			add
		</button>
	</div>

	<!-- Queue List -->
	<ul class="queue-list">
		{#each queue as song, i}
			<li class="queue-item" style="opacity: {1 - i * 0.1};">
				<span>{song.title}</span>
				<button
					on:click={() => queueOperations.removeFromQueue(i)}
					class="close material-symbols-outlined"
					aria-label="Remove from queue">
					close
				</button>
			</li>
		{/each}
	</ul>
</section>

<!-- Search Modal -->
{#if showSearch}
	<div
		class="fixed right-18 bottom-0 left-18 z-10 h-[90%] w-[430px] rounded-t-[30px] bg-stone-300"
		in:slide|local={{ duration: 300 }}
		out:slide|local={{ duration: 200 }}>
		<div class="mt-6 flex flex-col items-center justify-center">
			<button
				class="material-symbols-outlined slide cursor-pointer text-white"
				on:click={() => (showSearch = false)}>remove</button>

			<div class="relative mt-4 w-80">
				<input
					bind:value={searchQuery}
					type="text"
					maxlength="20"
					placeholder="Search for Prayer or Songs..."
					class="h-[60px] w-full rounded-[20px] bg-white pl-10 font-sans text-gray-400 shadow-[0_4px_4px_0_rgba(0,0,0,0.25)] hover:bg-stone-200" />
				<span
					class="material-symbols-outlined flame absolute top-1/2 left-1 -translate-y-1/2 transform text-black">
					local_fire_department
				</span>
			</div>
		</div>

		<h2
			class="mt-10 mb-5 text-center font-sans text-[18px] font-medium tracking-wide text-black underline">
			CATEGORIES
		</h2>

		<ul
			class="flex flex-col items-center justify-start space-y-1 overflow-y-auto"
			style="max-height: 300px; width: 90%; margin: auto; scroll-behavior:smooth">
		</ul>

		{#if filteredSongs.length > 0}
			<ul
				class="flex flex-col items-center justify-center space-y-3 overflow-y-auto"
				style="max-height: 440px; width: 90%; margin: auto; scroll-behavior: smooth;">
				{#each filteredSongs as song}
					<li
						class="flex h-[60px] w-[360px] cursor-pointer items-center justify-between rounded-[20px] bg-white px-7 font-sans font-bold shadow-[0_4px_4px_0_rgba(0,0,0,0.25)] hover:bg-stone-200">
						<span>{song.title}</span>
						<div
							class="h-[50px] w-[106px] rounded-[15px] bg-gray-300 shadow-[0_4px_4px_0_rgba(0,0,0,0.25)]">
							<div class="flex items-center justify-between px-3 pt-1">
								<button
									on:click={() => fetchLyrics(song)}
									class="material-symbols-outlined eye cursor-pointer text-black">
									visibility
								</button>
								<button
									on:click={() => queueOperations.addToQueue(song)}
									class="material-symbols-outlined plus flex h-10 w-10 cursor-pointer items-center justify-center rounded-[15px] bg-[#ff7f50] shadow-red-500/60 hover:bg-white">
									add
								</button>
							</div>
						</div>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="mt-4 text-center text-sm text-gray-500">No matching songs or prayers found.</p>
		{/if}
	</div>
{/if}

<!-- Lyrics Modal -->
{#if showLyrics}
	<div
		class="fixed right-18 bottom-0 left-18 z-10 h-[90%] w-[430px] rounded-t-[30px] bg-white"
		in:slide|local={{ duration: 300 }}
		out:slide|local={{ duration: 200 }}>
		<div class="flex flex-col items-center justify-center">
			<button
				on:click={() => (showLyrics = false)}
				class="material-symbols-outlined slide cursor-pointer text-[#ff7f50]">remove</button>
		</div>
		<h1 class="flex justify-center text-center font-sans font-bold text-[#ff7f50]">Lyrics</h1>
		<div
			class=" overflow-y-auto p-4 text-center font-sans text-sm font-medium whitespace-pre-line text-[#ff7f50]"
			style="max-height: 70%; width: 90%; margin: auto;">
			{lyrics}
		</div>
		<div class="mt-15 flex items-center justify-center">
			<div
				class="fixed bottom-5 flex h-15 w-90 transform items-center justify-center rounded-[20px] bg-white text-center font-sans text-2xl font-bold text-[#ff7f50] shadow-[0_4px_4px_0_rgba(0,0,0,0.25)]">
				{currentSong}
			</div>
		</div>
	</div>
{/if}

<style>
	/* Use CSS custom properties for consistent sizing */
	:root {
		--icon-size-sm: 25px;
		--icon-size-md: 30px;
		--icon-size-lg: 35px;
		--icon-size-xl: 40px;
	}

	.material-symbols-outlined {
		font-variation-settings:
			'FILL' 0,
			'wght' 400,
			'GRAD' 0,
			'opsz' 24;
	}

	.flame {
		font-size: var(--icon-size-lg);
	}
	.arrow {
		font-size: var(--icon-size-lg);
	}
	.share {
		font-size: var(--icon-size-sm);
	}
	.add {
		font-size: var(--icon-size-md);
	}
	.slide {
		font-size: var(--icon-size-xl);
	}
	.plus {
		font-size: var(--icon-size-lg);
	}
	.close {
		font-size: var(--icon-size-md);
	}

	/* Fix scrollbar styling */
	.queue-list {
		scrollbar-width: thin;
		scrollbar-color: #ccc transparent;
	}

	.queue-list::-webkit-scrollbar {
		width: 6px;
	}

	.queue-list::-webkit-scrollbar-thumb {
		background-color: #ccc;
		border-radius: 3px;
	}
</style>
