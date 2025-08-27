<script lang="ts">
	import { goto } from '$app/navigation';
	let code = '';

	function joinLobby() {
		goto('/lobby');
	}
	function handleJoin() {
		if (!code.trim()) {
			alert('Code is Required!');
			return;
		}
		joinLobby();
	}
</script>

<div class="mt-24 flex flex-col items-center justify-center">
	<div class="drop-shadow-l flex flex-row items-center justify-center">
		<span class="material-symbols-outlined flame-left mt-26 text-[90px] text-black"
			>local_fire_department</span>
		<span
			class="material-symbols-outlined mt-26 inline-block text-black"
			style="-webkit-text-stroke: 10px #ECECEC;">local_fire_department</span>
		<span class="material-symbols-outlined flame-right mt-26 text-black"
			>local_fire_department</span>
	</div>
	<div class="mt-20 space-y-2">
		<p class="text-sans text-xs font-bold">ROOM CODE</p>
		<input
			type="text"
			bind:value={code}
			maxlength="4"
			placeholder="Enter 4 digit code..."
			class=" text-gray h-20 w-72 rounded-xl bg-stone-200 px-4 shadow-[0_4px_4px_0_rgba(0,0,0,0.25)] drop-shadow-xl outline-none placeholder:text-gray-700" />
	</div>
	<button
		class="mt-11 cursor-pointer justify-center rounded-xl bg-black px-16 py-3 font-sans text-[14px] font-bold tracking-widest text-white shadow-[0_4px_4px_0_rgba(0,0,0,0.25)] hover:bg-gray-700"
		on:click={handleJoin}
		type="button">
		JOIN
	</button>
</div>

<style>
	.material-symbols-outlined {
		font-size: 200px;
		z-index: 2;
	}
	.flame-left {
		font-size: 90px;
		transform: translateX(75%);
		z-index: 1;
	}
	.flame-right {
		font-size: 90px;
		transform: translateX(-75%);
		z-index: 1;
	}
</style>
