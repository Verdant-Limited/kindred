<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabaseClient';
	import { slide } from 'svelte/transition';

	let showSearch = false;
	let showlyrics = false;
	let searchQuery = '';

	let songs: string[] = [];
	let queues: string[] = [];

	let lyrics = '';
	let currentSong = '';

	onMount(async () => {
		const { data, error } = await supabase.from('prayers_songs').select('title');

		if (error) {
			console.error('❌ Error fetching songs:', error.message);
		} else {
			songs = data.map((row) => row.title);
			console.log('✅ Songs loaded:', songs);
		}
	});

	function addToQueue(song: string) {
		if (!queues.includes(song)) {
			queues = [...queues, song];
		}
	}

	function addRemove(index: number): void {
		queues.splice(index, 1);
		queues = [...queues];
	}

	function addfilter(query: string): string[] {
		if (!query || query.trim() === '') {
			return songs;
		}
		return songs.filter((song) => song.toLowerCase().includes(query.toLowerCase()));
	}

	$: filteredSongs = addfilter(searchQuery);
	$: currentSong = queues[0];

	async function fetchLyrics(title: string) {
		const { data, error } = await supabase
			.from('prayers_songs')
			.select('lyrics')
			.eq('title', title)
			.single();

		if (error) {
			console.error('❌ Error fetching lyrics:', error.message);
			lyrics = 'Lyrics not found.';
		} else {
			lyrics = data.lyrics;
			currentSong = title;
			showlyrics = true;
		}
	}
</script>

<div class="flex items-center justify-between px-3 py-4">
	<button class="pt-6 pl-6 font-sans text-xl font-semibold tracking-widest text-black"
		>Hey, !</button>
	<button class="material-symbols-outlined share cursor-pointer pt-6 pr-6"> share </button>
</div>

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
			on:click={() => (showlyrics = true)}>keyboard_arrow_up</button>
	</div>
</div>

<div class="mt-10 flex items-center justify-between px-20 py-4">
	<p class="font-sans text-[10px] font-bold tracking-wide">QUEUED</p>
	<p class=" mr-39 h-6 w-6 rounded-full bg-white pl-1.5 font-semibold">
		{queues.length}
	</p>
	<button
		on:click={() => (showSearch = true)}
		class="material-symbols-outlined add mb-1 h-7 w-10 cursor-pointer rounded-[20px] bg-gray-300 shadow-[0_4px_4px_0_rgba(0,0,0,0.25)] hover:bg-white"
		>add</button>
</div>
<ul
	class="flex flex-col items-center justify-start space-y-1 overflow-y-auto"
	style="max-height: 300px; width: 90%; margin: auto; scroll-behavior:smooth">
	{#each queues as queue, i}
		<div class="flex items-center justify-center px-2 py-1">
			<li
				class="flex h-15 w-75 items-center justify-between rounded-[20px] bg-white px-2 pt-1 text-center font-sans text-[20px] font-semibold text-black shadow-[0_4px_4px_0_rgba(0,0,0,0.25)]"
				style="opacity: {1 - i * 0.1};">
				{queue}
				<button
					class="close material-symbols-outlined cursor-pointer text-orange-500 hover:text-red-500"
					on:click={() => addRemove(i)}>close</button>
			</li>
		</div>
	{/each}
</ul>

{#if showSearch}
	<div
		class="fixed right-18 bottom-0 left-18 z-10 h-[90%] w-[430px] rounded-t-[30px] bg-stone-300"
		in:slide={{ duration: 300 }}
		out:slide={{ duration: 200 }}>
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
						<span>{song}</span>
						<div
							class="h-[50px] w-[106px] rounded-[15px] bg-gray-300 shadow-[0_4px_4px_0_rgba(0,0,0,0.25)]">
							<div class="flex items-center justify-between px-3 pt-1">
								<button
									on:click={() => fetchLyrics(song)}
									class="material-symbols-outlined eye cursor-pointer text-black">
									visibility
								</button>
								<button
									on:click={() => addToQueue(song)}
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

{#if showlyrics}
	<div
		class="fixed right-18 bottom-0 left-18 z-10 h-[90%] w-[430px] rounded-t-[30px] bg-white"
		in:slide={{ duration: 300 }}
		out:slide={{ duration: 200 }}>
		<div class="flex flex-col items-center justify-center">
			<button
				on:click={() => (showlyrics = false)}
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
	.flame {
		font-size: 35px;
	}
	.arrow {
		font-size: 35px;
	}
	.share {
		font-size: 25px;
	}
	.add {
		font-size: 30px;
	}
	.slide {
		font-size: 40px;
	}
	.plus {
		font-size: 35px;
	}
	ul::-webkit-scrollbar-thumn {
		background-color: #ccc;
		border-radius: 10px;
	}
	.close {
		font-size: 30px;
	}
</style>
