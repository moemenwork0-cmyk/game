#include "WarBreachDirector.h"
#include "SWarTouchControls.h"
#include "WarCharacter.h"
#include "WarFX.h"
#include "WarPlayerController.h"
#include "WarSoldier.h"
#include "Animation/AnimSequence.h"
#include "Camera/CameraComponent.h"
#include "Components/AudioComponent.h"
#include "Components/PointLightComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/SkeletalMesh.h"
#include "Engine/StaticMesh.h"
#include "Engine/StaticMeshActor.h"
#include "Engine/Texture2D.h"
#include "EngineUtils.h"
#include "Kismet/GameplayStatics.h"
#include "Materials/MaterialInterface.h"
#include "Misc/CommandLine.h"
#include "Misc/Parse.h"
#include "Sound/SoundBase.h"
#include "Sound/SoundWave.h"

namespace
{
	const TCHAR* ClipNames[] = { TEXT("Walking"), TEXT("Running"), TEXT("Running_Jump"), TEXT("Plant_A_Plant"), TEXT("Kneeling_Idle"),
		TEXT("Breathing_Idle"), TEXT("Jump_Away"), TEXT("Getting_Up"), TEXT("Waving") };
	const TCHAR* SheetNames[] = { TEXT("Explosion02HD_5x5"), TEXT("Explosion00_5x5"), TEXT("Explosion01_5x5"), TEXT("FireBall02_8x8"),
		TEXT("WispySmoke02_8x8"), TEXT("DiscSmoke01_16x4"), TEXT("Cloud02_8x8") };
	const TCHAR* SoundNames[] = { TEXT("Explosion"), TEXT("ExplosionPunch"), TEXT("Distant"), TEXT("Rumble"), TEXT("Beep"), TEXT("Wind"),
		TEXT("Heartbeat"), TEXT("Footsteps"), TEXT("Click"), TEXT("Rocks"), TEXT("Radio"), TEXT("Tinnitus") };
	const float WalkSpeed = 163.f;  // cm/s of the Walking clip at rate 1 (Tools/Blender/prep_soldier.py)
	const float RunSpeed = 540.f;

	// Eyelids while waking: (time, black) keys.
	const FVector2D Lids[] = { {0.f, 1.f}, {0.7f, 1.f}, {1.2f, 0.45f}, {1.6f, 1.f}, {2.4f, 0.15f}, {2.8f, 0.75f}, {3.6f, 0.f} };

	float Keys(const FVector2D* K, int32 N, float T)
	{
		if (T <= K[0].X) return K[0].Y;
		for (int32 i = 1; i < N; ++i)
		{
			if (T <= K[i].X)
			{
				const float A = (T - K[i - 1].X) / (K[i].X - K[i - 1].X);
				return FMath::Lerp(K[i - 1].Y, K[i].Y, FMath::SmoothStep(0.f, 1.f, A));
			}
		}
		return K[N - 1].Y;
	}
}

AWarBreachDirector::AWarBreachDirector()
{
	PrimaryActorTick.bCanEverTick = true;
	RootComponent = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	BlastLight = CreateDefaultSubobject<UPointLightComponent>(TEXT("BlastLight"));
	BlastLight->SetupAttachment(RootComponent);
	BlastLight->SetIntensity(0.f);
	BlastLight->SetAttenuationRadius(6000.f);
	BlastLight->SetLightColor(FLinearColor(1.f, 0.55f, 0.25f));
	BlastLight->SetCastShadows(false);
}

void AWarBreachDirector::BeginPlay()
{
	Super::BeginPlay();
	bAuto = FParse::Param(FCommandLine::Get(), TEXT("autodetonate"));
	bCapture = FParse::Param(FCommandLine::Get(), TEXT("story")) || bAuto;
	// The charges go on the bunker's face toward the player (-X); its rocks plug the opening.
	for (TActorIterator<AActor> It(GetWorld()); It; ++It)
	{
		if (It->ActorHasTag("Bunker"))
		{
			FVector Origin, Extent;
			It->GetActorBounds(false, Origin, Extent);
			Door = FVector(Origin.X - Extent.X + 60.f, Origin.Y, 0.f);
			DoorHalfWidth = Extent.Y;
			UE_LOG(LogTemp, Display, TEXT("Director: bunker front at %s, half width %.0f"), *Door.ToString(), Extent.Y);
		}
	}
	BlastLight->SetWorldLocation(Door + FVector(-300.f, 0.f, 300.f));
	if (UStaticMesh* Boulder = LoadObject<UStaticMesh>(nullptr, TEXT("/Game/Props/SM_Boulder.SM_Boulder")))
	{
		for (const FVector4& P : { FVector4(-90.f, -170.f, 0.f, 0.62f), FVector4(-70.f, 10.f, 0.f, 0.72f), FVector4(-95.f, 190.f, 0.f, 0.58f),
			FVector4(-60.f, -60.f, 110.f, 0.45f) })
		{
			AStaticMeshActor* R = GetWorld()->SpawnActor<AStaticMeshActor>(Door + FVector(P.X, P.Y, P.Z), FRotator(0.f, FMath::FRandRange(0.f, 360.f), 0.f));
			R->SetMobility(EComponentMobility::Movable);
			R->GetStaticMeshComponent()->SetStaticMesh(Boulder);
			R->SetActorScale3D(FVector(P.W));
			R->Tags.Add("Plug");
		}
	}

	FlipbookMaterial = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/FX/M_Flipbook.M_Flipbook"));
	for (const TCHAR* S : SheetNames)
	{
		Sheets.Add(S, LoadObject<UTexture2D>(nullptr, *FString::Printf(TEXT("/Game/FX/T_%s.T_%s"), S, S)));
	}
	for (const TCHAR* S : SoundNames)
	{
		Sounds.Add(S, LoadObject<USoundBase>(nullptr, *FString::Printf(TEXT("/Game/Audio/S_%s.S_%s"), S, S)));
	}
	RockMesh = LoadObject<UStaticMesh>(nullptr, TEXT("/Game/Props/SM_Rock.SM_Rock"));

	Alpha = SpawnSoldier(FVector(230.f, 110.f, 0.f), 200.f);
	Bravo = SpawnSoldier(FVector(620.f, -230.f, 0.f), 10.f);

	// Two charges on the bunker face, hidden until planted; red LEDs blink once armed.
	UStaticMesh* C4 = LoadObject<UStaticMesh>(nullptr, TEXT("/Game/Props/SM_C4.SM_C4"));
	for (float Side : { -1.f, 1.f })
	{
		if (UStaticMeshComponent* C = SpawnProp(C4, 32.f))
		{
			C->SetWorldLocation(Door + FVector(-25.f, Side * FMath::Min(240.f, DoorHalfWidth * 0.4f), 95.f));
			C->SetWorldRotation(FRotator(0.f, 90.f, 90.f));
			C->SetVisibility(false);
			Charges.Add(C);
			UPointLightComponent* L = NewObject<UPointLightComponent>(this);
			L->SetupAttachment(RootComponent);
			L->RegisterComponent();
			L->SetWorldLocation(C->GetComponentLocation() + FVector(-15.f, 0.f, 8.f));
			L->SetLightColor(FLinearColor::Red);
			L->SetAttenuationRadius(140.f);
			L->SetIntensity(0.f);
			L->SetCastShadows(false);
			ChargeLights.Add(L);
		}
	}
}

AWarSoldier* AWarBreachDirector::SpawnSoldier(const FVector& Where, float Yaw)
{
	USkeletalMesh* Body = LoadObject<USkeletalMesh>(nullptr, TEXT("/Game/Chars/Soldier/Soldier.Soldier"));
	if (!Body)
	{
		UE_LOG(LogTemp, Warning, TEXT("Director: soldier mesh missing"));
		return nullptr;
	}
	AWarSoldier* S = GetWorld()->SpawnActor<AWarSoldier>(Where, FRotator(0.f, Yaw, 0.f));
	S->Mesh->SetSkeletalMesh(Body);
	S->Mesh->SetRelativeRotation(FRotator(0.f, MeshYaw, 0.f));
	for (const TCHAR* Name : ClipNames)
	{
		S->Clips.Add(Name, LoadObject<UAnimSequence>(nullptr, *FString::Printf(TEXT("/Game/Chars/Soldier/Anim_%s.Anim_%s"), Name, Name)));
	}
	return S;
}

UStaticMeshComponent* AWarBreachDirector::SpawnProp(UStaticMesh* Mesh, float SizeCm, USceneComponent* AttachTo)
{
	if (!Mesh)
	{
		return nullptr;
	}
	UStaticMeshComponent* C = NewObject<UStaticMeshComponent>(this);
	C->SetStaticMesh(Mesh);
	C->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	C->SetupAttachment(AttachTo ? AttachTo : RootComponent.Get());
	C->RegisterComponent();
	// Normalise the scanned/downloaded prop to a real-world size along its longest side.
	const float Longest = Mesh->GetBounds().BoxExtent.GetMax() * 2.f;
	C->SetWorldScale3D(FVector(SizeCm / FMath::Max(Longest, 1.f)));
	return C;
}

void AWarBreachDirector::Sound(const TCHAR* Name, float Volume, const FVector* Where)
{
	USoundBase* S = Sounds.FindRef(Name);
	if (!S)
	{
		return;
	}
	if (Where)
	{
		UGameplayStatics::PlaySoundAtLocation(this, S, *Where, Volume);
	}
	else
	{
		UGameplayStatics::PlaySound2D(this, S, Volume);
	}
	// The offline capture has no audio device: the render script rebuilds the soundtrack from these.
	if (bCapture && PC)
	{
		UE_LOG(LogTemp, Display, TEXT("SFX %s %d %.2f"), Name, PC->CaptureFrame(), Volume);
	}
}

UAudioComponent* AWarBreachDirector::Loop(const TCHAR* Name, float Volume)
{
	USoundBase* S = Sounds.FindRef(Name);
	if (USoundWave* W = Cast<USoundWave>(S))
	{
		W->bLooping = true;
	}
	UAudioComponent* A = S ? UGameplayStatics::SpawnSound2D(this, S, Volume) : nullptr;
	if (A)
	{
		Loops.Add(A);
	}
	if (bCapture && PC)
	{
		UE_LOG(LogTemp, Display, TEXT("SFXLOOP %s %d %.2f"), Name, PC->CaptureFrame(), Volume);
	}
	return A;
}

void AWarBreachDirector::Muffle(bool bOn)
{
	for (UAudioComponent* A : Loops)
	{
		if (A)
		{
			A->SetLowPassFilterEnabled(bOn);
			A->SetLowPassFilterFrequency(bOn ? 500.f : 20000.f);
		}
	}
}

void AWarBreachDirector::SpawnFX(const TCHAR* Sheet, const FVector& Where, float Duration, float From, float To, const FVector& Vel,
	FLinearColor Tint, float Glow, float Delay)
{
	UTexture2D* Tex = Sheets.FindRef(Sheet);
	if (!Tex)
	{
		return;
	}
	AWarFX::FSpec Spec;
	Spec.Texture = Tex;
	FString Grid = FString(Sheet).RightChop(FString(Sheet).Find(TEXT("_"), ESearchCase::IgnoreCase, ESearchDir::FromEnd) + 1);
	FString C, R;
	Grid.Split(TEXT("x"), &C, &R);
	Spec.Cols = FCString::Atoi(*C);
	Spec.Rows = FCString::Atoi(*R);
	Spec.Duration = Duration;
	Spec.StartSize = From;
	Spec.EndSize = To;
	Spec.Velocity = Vel;
	Spec.Tint = Tint;
	Spec.Glow = Glow;
	Spec.Delay = Delay;
	AWarFX::Spawn(GetWorld(), FlipbookMaterial, Where, Spec);
}

void AWarBreachDirector::SpawnDistantBlast()
{
	const FVector Far(FMath::FRandRange(14000.f, 26000.f), FMath::FRandRange(-16000.f, 16000.f), 400.f);
	SpawnFX(TEXT("Explosion01_5x5"), Far, 2.2f, 1500.f, 4500.f, FVector(0, 0, 120.f), FLinearColor(1.f, 0.9f, 0.8f), 3.f);
	SpawnFX(TEXT("WispySmoke02_8x8"), Far + FVector(0, 0, 600.f), 7.f, 2500.f, 7000.f, FVector(0, 0, 250.f), FLinearColor(0.25f, 0.23f, 0.22f), 0.6f, 0.6f);
	Sound(TEXT("Distant"), 0.8f);
}

void AWarBreachDirector::Look(const FVector& Point, float Speed)
{
	LookPoint = Point;
	LookSpeed = Speed;
}

void AWarBreachDirector::StartIntro()
{
	Phase = EPhase::Intro;
	Time = 0.f;
	SWarTouchControls* Hud = PC->GetTouchControls();
	if (Hud)
	{
		Hud->SetControlsVisible(false);
		Hud->SetFade(1.f);
	}
	// Lying on the sand, head turned to the sky; the world comes back through the ringing.
	Player->SetCameraPose(FVector(0.f, 0.f, -150.f), FRotator(0.f, 0.f, 70.f));
	Player->SetDaze(1.f, 1.f, 0.6f);
	PC->SetControlRotation(FRotator(35.f, 20.f, 0.f));
	Loop(TEXT("Wind"), 0.35f);
	Loop(TEXT("Heartbeat"), 0.9f);
	Muffle(true);
	Sound(TEXT("Tinnitus"), 0.35f);
	if (Alpha) { Alpha->Play("Kneeling_Idle", true); Alpha->FaceTowards(Player->GetActorLocation()); }
	if (Bravo) { Bravo->Play("Breathing_Idle", true); Bravo->FaceTowards(Door); }
	Look(Alpha ? Alpha->GetActorLocation() + FVector(0, 0, 120.f) : Door, 0.8f);

	Cue(1.8f, [this] { SpawnDistantBlast(); });
	Cue(3.4f, [this] { SpawnDistantBlast(); Player->AddShake(0.25f, 1.2f); });
	Cue(4.2f, [this] { Sound(TEXT("Radio"), 0.6f); });
	Cue(7.2f, [this]
	{
		if (UAudioComponent* Heart = Loops.Num() > 1 ? Loops[1].Get() : nullptr) { Heart->FadeOut(1.5f, 0.f); }
		Muffle(false);
		if (SWarTouchControls* H = PC->GetTouchControls())
		{
			H->SetControlsVisible(true);
			H->SetObjective(TEXT("FOLLOW THE BREACH TEAM"));
		}
		Sound(TEXT("Footsteps"), 0.5f);
		auto Plant = [this](AWarSoldier* S, float Side)
		{
			if (!S) return;
			S->MoveTo(Door + FVector(-95.f, Side * 240.f, 0.f), WalkSpeed * 1.3f, "Walking", 1.3f, [this, S, Side]
			{
				S->FaceTowards(Door + FVector(500.f, Side * 240.f, 0.f));
				S->Play("Plant_A_Plant", false, 1.35f);
				const float Done = Time + 4.2f;
				Cue(Done, [this, S, Side]
				{
					const int32 i = Side < 0.f ? 0 : 1;
					if (Charges.IsValidIndex(i)) { Charges[i]->SetVisibility(true); }
					bChargesArmed = true;
					Sound(TEXT("Beep"), 0.7f);
					S->Play("Breathing_Idle", true);
					S->MoveTo(Door + FVector(-380.f, Side * 430.f, 0.f), WalkSpeed * 1.2f, "Walking", 1.2f, [this, S]
					{
						S->FaceTowards(Player->GetActorLocation());
						S->Play("Breathing_Idle", true);
						if (++ReadyCount == 2) { Cue(Time + 0.8f, [this] { Phase = EPhase::Ready; }); }
					});
				});
			});
		};
		Plant(Alpha, -1.f);
		Plant(Bravo, 1.f);
		Look(Door + FVector(-600.f, 0.f, 120.f), 0.6f);
	});
}

void AWarBreachDirector::Detonate()
{
	if (Phase != EPhase::Ready)
	{
		return;
	}
	Phase = EPhase::Countdown;
	Time = 0.f;
	Cues.Reset();
	DetonatorPress = 0.f;
	Sound(TEXT("Click"), 1.f);
	SWarTouchControls* Hud = PC->GetTouchControls();
	if (Hud)
	{
		Hud->SetPrompt(TEXT(""));
		Hud->SetCountdown(3);
		Hud->SetObjective(TEXT("TAKE COVER"));
	}
	Sound(TEXT("Beep"), 1.f);
	auto Run = [this](AWarSoldier* S, float Side)
	{
		if (!S) return;
		S->MoveTo(FVector(520.f, Side * 520.f, 0.f), RunSpeed, "Running", 1.f);
		Cue(1.15f, [S] { S->Play("Running_Jump", false, 1.f); });
		Cue(1.15f + S->ClipLength("Running_Jump"), [S] { S->Play("Running", true, 1.f); });
		Cue(2.75f, [this, S] { S->Stop(); S->Play("Jump_Away", false, 1.25f); });
	};
	Run(Alpha, -1.f);
	Run(Bravo, 1.f);
	Cue(1.f, [this] { if (SWarTouchControls* H = PC->GetTouchControls()) H->SetCountdown(2); Sound(TEXT("Beep"), 1.f); });
	Cue(2.f, [this] { if (SWarTouchControls* H = PC->GetTouchControls()) H->SetCountdown(1); Sound(TEXT("Beep"), 1.f); });
	Cue(2.6f, [this] { Sound(TEXT("Beep"), 1.f); });
	Cue(3.f, [this] { Blast(); });
	Look(Door + FVector(0.f, 0.f, 200.f), 1.5f);
}

void AWarBreachDirector::Blast()
{
	Phase = EPhase::After;
	Time = 0.f;
	Cues.Reset();
	SWarTouchControls* Hud = PC->GetTouchControls();
	if (Hud)
	{
		Hud->SetCountdown(0);
		Hud->SetObjective(TEXT(""));
	}
	for (UStaticMeshComponent* C : Charges) { if (C) C->SetVisibility(false); }
	for (UPointLightComponent* L : ChargeLights) { if (L) L->SetIntensity(0.f); }
	bChargesArmed = false;
	if (Detonator) { Detonator->SetVisibility(false); }
	FlashLevel = 1.f;
	BlastLightLevel = 1.f;

	const FVector C = Door + FVector(-80.f, 0.f, 150.f);
	Sound(TEXT("ExplosionPunch"), 1.f);
	Sound(TEXT("Explosion"), 1.f);
	Sound(TEXT("Rumble"), 0.8f);
	Sound(TEXT("Tinnitus"), 0.5f);
	Muffle(true);
	Player->AddShake(1.f, 3.2f);
	Player->SetDaze(0.6f, 0.6f, 0.7f);

	// Core fireball, a second blast just after, the shock of dust along the ground, then smoke.
	SpawnFX(TEXT("Explosion02HD_5x5"), C, 1.9f, 700.f, 2600.f, FVector(0, 0, 150.f), FLinearColor(1.f, 0.85f, 0.7f), 4.f);
	SpawnFX(TEXT("FireBall02_8x8"), C + FVector(-60.f, -120.f, 60.f), 1.3f, 500.f, 1600.f, FVector(-100.f, 0, 250.f), FLinearColor(1.f, 0.8f, 0.6f), 5.f, 0.05f);
	SpawnFX(TEXT("Explosion00_5x5"), C + FVector(-40.f, 200.f, 120.f), 1.6f, 500.f, 1900.f, FVector(0, 100.f, 200.f), FLinearColor::White, 4.f, 0.15f);
	SpawnFX(TEXT("DiscSmoke01_16x4"), Door + FVector(-200.f, 0.f, 60.f), 3.2f, 800.f, 4200.f, FVector(-250.f, 0, 40.f), FLinearColor(0.75f, 0.62f, 0.48f), 0.9f, 0.1f);
	for (int32 i = 0; i < 4; ++i)
	{
		SpawnFX(TEXT("WispySmoke02_8x8"), C + FVector(FMath::FRandRange(-150.f, 150.f), FMath::FRandRange(-300.f, 300.f), 200.f + i * 150.f),
			6.5f, 900.f, 3200.f, FVector(-60.f, FMath::FRandRange(-80.f, 80.f), 180.f + i * 40.f), FLinearColor(0.22f, 0.2f, 0.19f), 0.5f, 0.3f + i * 0.25f);
	}
	SpawnFX(TEXT("Cloud02_8x8"), Door + FVector(-500.f, 0.f, 150.f), 9.f, 1500.f, 4500.f, FVector(-120.f, 0, 60.f), FLinearColor(0.7f, 0.6f, 0.5f), 0.7f, 0.8f);

	// The rocks plugging the entrance (tag "Plug") and a spray of smaller stones fly out.
	for (TActorIterator<AStaticMeshActor> It(GetWorld()); It; ++It)
	{
		if (It->ActorHasTag("Plug"))
		{
			It->GetStaticMeshComponent()->SetMobility(EComponentMobility::Movable);
			const FVector V(FMath::FRandRange(-1700.f, -900.f), FMath::FRandRange(-700.f, 700.f), FMath::FRandRange(700.f, 1300.f));
			Debris.Add({ *It, V, FRotator(FMath::FRandRange(-400.f, 400.f), FMath::FRandRange(-400.f, 400.f), FMath::FRandRange(-400.f, 400.f)) });
		}
	}
	for (int32 i = 0; i < 16 && RockMesh; ++i)
	{
		AStaticMeshActor* R = GetWorld()->SpawnActor<AStaticMeshActor>(C, FRotator(FMath::FRandRange(0.f, 360.f), FMath::FRandRange(0.f, 360.f), 0.f));
		R->SetMobility(EComponentMobility::Movable);
		R->GetStaticMeshComponent()->SetStaticMesh(RockMesh);
		R->GetStaticMeshComponent()->SetCollisionEnabled(ECollisionEnabled::NoCollision);
		R->SetActorScale3D(FVector(FMath::FRandRange(0.12f, 0.35f)));
		const FVector V(FMath::FRandRange(-2600.f, -600.f), FMath::FRandRange(-1600.f, 1600.f), FMath::FRandRange(600.f, 1800.f));
		Debris.Add({ R, V, FRotator(FMath::FRandRange(-720.f, 720.f), FMath::FRandRange(-720.f, 720.f), 0.f) });
	}
	Cue(0.7f, [this] { Sound(TEXT("Rocks"), 0.9f); });
	Cue(3.f, [this] { Muffle(false); });
	Cue(2.4f, [this]
	{
		for (AWarSoldier* S : { Alpha.Get(), Bravo.Get() })
		{
			if (!S) continue;
			S->SettleOnHips();
			S->Play("Getting_Up", false, 1.1f);
		}
	});
	Cue(2.4f + 2.6f, [this]
	{
		for (AWarSoldier* S : { Alpha.Get(), Bravo.Get() })
		{
			if (!S) continue;
			S->FaceTowards(Player->GetActorLocation());
			S->Play("Waving", true, 1.f);
		}
		if (SWarTouchControls* H = PC->GetTouchControls()) H->SetObjective(TEXT("ENTER THE BUNKER"));
		Look(Door + FVector(0.f, 0.f, 120.f), 0.8f);
	});
}

void AWarBreachDirector::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	if (!Player || !PC)
	{
		PC = Cast<AWarPlayerController>(UGameplayStatics::GetPlayerController(this, 0));
		Player = PC ? Cast<AWarCharacter>(PC->GetPawn()) : nullptr;
		if (!Player)
		{
			return;
		}
	}
	SWarTouchControls* Hud = PC->GetTouchControls();
	if (Phase == EPhase::Waiting)
	{
		if (FParse::Param(FCommandLine::Get(), TEXT("nostory")))
		{
			return;
		}
		// The offline capture starts the story on its first recorded frame.
		if (!PC->IsCapturing() || PC->CaptureFrame() >= 0)
		{
			StartIntro();
		}
		return;
	}
	Time += DeltaSeconds;

	for (int32 i = 0; i < Cues.Num();)
	{
		if (Time >= Cues[i].At)
		{
			TFunction<void()> Run = MoveTemp(Cues[i].Run);
			Cues.RemoveAtSwap(i);
			Run();
		}
		else
		{
			++i;
		}
	}

	if (Phase == EPhase::Intro && Hud)
	{
		Hud->SetFade(Keys(Lids, UE_ARRAY_COUNT(Lids), Time));
		// Getting up between 4.5 s and 7 s.
		const float Up = FMath::SmoothStep(4.5f, 7.f, Time);
		Player->SetCameraPose(FVector(0.f, 0.f, -150.f * (1.f - Up)), FRotator(0.f, 0.f, 70.f * (1.f - Up)));
		const float Daze = 1.f - FMath::SmoothStep(2.f, 7.5f, Time);
		Player->SetDaze(Daze, Daze, 0.6f * Daze);
	}
	if (Phase == EPhase::Ready && Hud && !Detonator)
	{
		// The detonator in the player's hand and the prompt.
		Detonator = SpawnProp(LoadObject<UStaticMesh>(nullptr, TEXT("/Game/Props/SM_Detonator.SM_Detonator")), 22.f, Player->Camera);
		if (Detonator)
		{
			Detonator->SetRelativeLocation(FVector(38.f, 7.f, -21.f));
			Detonator->SetRelativeRotation(FRotator(0.f, 160.f, 0.f));
		}
		Hud->SetObjective(TEXT("DETONATE THE CHARGES"));
		Hud->SetPrompt(TEXT("TAP TO DETONATE"));
		Hud->SetDetonator(true, [this] { Detonate(); });
		Sound(TEXT("Radio"), 0.6f);
		Time = 0.f;
	}
	if (Phase == EPhase::Ready && Hud)
	{
		Hud->Pulse(Time);
		if (bAuto && Time > 1.6f)
		{
			Hud->SetDetonator(false, nullptr);
			Detonate();
		}
	}

	// Detonator plunger dip.
	if (Detonator && DetonatorPress >= 0.f)
	{
		DetonatorPress += DeltaSeconds;
		const float Dip = FMath::Sin(FMath::Clamp(DetonatorPress / 0.3f, 0.f, 1.f) * PI) * 4.f;
		Detonator->SetRelativeLocation(FVector(38.f, 7.f, -21.f - Dip));
	}

	// Charge LEDs: blink with a soft beep.
	if (bChargesArmed)
	{
		BeepClock += DeltaSeconds;
		const bool bOn = FMath::Fmod(BeepClock, 1.f) < 0.15f;
		for (UPointLightComponent* L : ChargeLights) { if (L) L->SetIntensity(bOn ? 600.f : 0.f); }
	}

	// Flash and fireball light decay; daze clears after the blast.
	if (Hud)
	{
		FlashLevel = FMath::Max(0.f, FlashLevel - DeltaSeconds * 1.8f);
		Hud->SetFlash(FlashLevel * 0.85f);
	}
	BlastLightLevel = FMath::Max(0.f, BlastLightLevel - DeltaSeconds * 0.9f);
	BlastLight->SetIntensity(BlastLightLevel * 400000.f);
	if (Phase == EPhase::After)
	{
		const float D = 1.f - FMath::SmoothStep(0.f, 3.f, Time);
		Player->SetDaze(0.6f * D, 0.6f * D, 0.7f * D);
	}

	// Ballistic debris (no physics bodies needed on the scans).
	for (FDebris& D : Debris)
	{
		AActor* A = D.Actor.Get();
		if (!A) continue;
		FVector L = A->GetActorLocation();
		if (L.Z <= 15.f && D.Velocity.Z < 0.f)
		{
			D.Velocity *= FVector(0.35f, 0.35f, -0.25f);
			D.Spin *= 0.5f;
			if (D.Velocity.Size() < 120.f) { D.Velocity = FVector::ZeroVector; D.Spin = FRotator::ZeroRotator; }
		}
		D.Velocity.Z -= 980.f * DeltaSeconds;
		L += D.Velocity * DeltaSeconds;
		L.Z = FMath::Max(L.Z, 10.f);
		A->SetActorLocation(L);
		A->AddActorLocalRotation(D.Spin * DeltaSeconds);
	}

	// Story camera: steer the player's view (always in the capture; in play only until they move).
	if (LookSpeed > 0.f && (bCapture || Phase == EPhase::Intro))
	{
		const FVector Eye = Player->Camera->GetComponentLocation();
		const FRotator Want = (LookPoint - Eye).Rotation();
		PC->SetControlRotation(FMath::RInterpTo(PC->GetControlRotation(), Want, DeltaSeconds, LookSpeed));
	}
}
