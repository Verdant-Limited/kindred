<script lang="ts">
	import { fly } from 'svelte/transition';

	let createRoom = $state(true);

	function toggleView(value: boolean) {
		createRoom = value;
	}
</script>

<div class="flex h-full w-full flex-col items-center justify-between p-16">
	<h1 class="mr-auto text-xl font-semibold tracking-widest uppercase">Kindled</h1>
	{#if createRoom}
		<div transition:fly={{ x: 50 }} class="flex w-2/3 flex-col items-center text-center">
			<span style:font-size="200px" class="material-symbols-outlined mb-12">
				local_fire_department
			</span>
			<h2 class="mb-4 text-3xl font-semibold tracking-wide uppercase">Open Program</h2>
			<p class="font-light">Start an open program where anyone can add songs & prayers</p>

			<button
				class="bg-primary mt-16 w-2/3 cursor-pointer rounded-2xl p-4 font-semibold tracking-wide text-white uppercase duration-200 ease-out hover:-translate-y-1">
				Start
			</button>
		</div>
	{:else}
		<!-- <div transition:fly={{ x: 100 }}>Join Room</div> -->
	{/if}

	<nav class="drop-shadow-soft relative flex h-16 w-96 rounded-full bg-white">
		<div class="absolute top-0 left-0 flex h-full w-full p-1.5">
			<div
				class:translate-x-full={!createRoom}
				class="bg-fire h-full w-1/2 rounded-full duration-200 ease-out">
			</div>
		</div>
		<div class="z-10 flex w-full flex-row items-center">
			<button
				onclick={() => toggleView(true)}
				class:text-white={createRoom}
				class="flex h-full w-full cursor-pointer items-center justify-center text-sm font-bold duration-200 ease-out">
				CREATE ROOM
			</button>
			<button
				onclick={() => toggleView(false)}
				class:text-white={!createRoom}
				class="flex h-full w-full cursor-pointer items-center justify-center text-sm font-bold duration-200 ease-out">
				JOIN ROOM
			</button>
		</div>
	</nav>
</div>
