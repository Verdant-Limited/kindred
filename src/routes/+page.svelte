<script lang="ts">
	import CreateRoom from '$lib/components/CreateRoom.svelte';
	import JoinRoom from '$lib/components/JoinRoom.svelte';

	let mode: 'create' | 'join' = 'create';
	let createRoomRef: CreateRoom;
	let joinRoomRef: JoinRoom;

	function handleRoomToggle(newMode: 'create' | 'join') {
		mode = newMode;
		// Auto-focus the input in the respective component after transition
		setTimeout(() => {
			if (newMode === 'create') {
				createRoomRef?.focusTitle();
			} else {
				joinRoomRef?.focusCodeInput();
			}
		}, 100);
	}
</script>

<h1
	class="pt-8 pl-9 font-sans text-xl font-bold tracking-widest text-black drop-shadow-2xl dark:text-white">
	KINDLED
</h1>

{#if mode === 'create'}
	<CreateRoom bind:this={createRoomRef} />
{:else if mode === 'join'}
	<JoinRoom bind:this={joinRoomRef} />
{/if}

<div class="mt-30 flex flex-col items-center justify-end">
	<div
		class="relative mb-7 grid grid-cols-2 rounded-l-full rounded-r-full border border-gray-200 bg-white shadow-[0_4px_4px_0_rgba(0,0,0,0.15)] dark:border-[#3a3a3a] dark:bg-[#2a2a2a] dark:shadow-[0_4px_4px_0_rgba(0,0,0,0.5)]">
		<div
			class=" absolute top-[5px] left-[8px] z-[1] h-[46px] w-1/2 rounded-[100px] bg-[#ffa843] shadow-[0_0px_16px_rgba(255,168,67,0.3)] transition-transform duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]"
			style="transform: {mode === 'create' ? 'translateX(0%)' : 'translateX(calc(100% - 16px))'}">
		</div>
		<button
			class="z-10 w-full cursor-pointer px-7 py-4 font-sans font-bold"
			class:text-white={mode === 'create'}
			class:text-black={mode === 'join'}
			class:dark:text-[#a0a0a0]={mode === 'join'}
			on:click={() => handleRoomToggle('create')}>
			CREATE ROOM
		</button>
		<button
			class="z-10 w-full cursor-pointer px-7 py-4 font-sans font-bold"
			class:text-white={mode === 'join'}
			class:text-black={mode === 'create'}
			class:dark:text-[#a0a0a0]={mode === 'create'}
			on:click={() => handleRoomToggle('join')}>
			JOIN ROOM
		</button>
	</div>
</div>
